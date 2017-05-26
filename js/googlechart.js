googlechart = function() {
	const _rePrintemps = /\bprintemps\b ?(\d+)?/i;
	var _chartWrapper = null;
	var _chartIndex = 0;
	var _chartTypeIndex = 0;
	var _chartStateList = []; 	// list of google chart state
	var _chartStateHist = [
		{charttype: 'LineChart', datatable: null, viewtable: null, options: null},
		{charttype: 'LineChart', datatable: null, viewtable: null, options: null}
	];


	/**
	 * Draw google chart
	 * @param {object} chart         : parameters for google chart
	 * @param {object} chartTypeIndex: 0 = temps, 1 = rate temp, 2 = temp history, 3 = degree day
	 */
	function buildChart( chart, chartTypeIndex ) {
		var chartState = getChartState( chart.chartindex, chartTypeIndex );
		var filteredRowIndexes = [];

		// chart indexes for resize draw
		_chartIndex = chart.chartindex;
		_chartTypeIndex = chartTypeIndex;

		/* -- temps + rate temp chart -- */
		if (_chartTypeIndex < 2) {
			filteredRowIndexes = getFilteredRowIndexes( chartState.datatable, chart.offset );
			chartState.viewtable = getFilteredViewtable( chartState.datatable, filteredRowIndexes );
			if (_chartTypeIndex == 0) {
				// adjust min/max value options for temps chart
				chartState.options = initOptionsRangeY( chartState.options, chartState.viewtable );
			}
		}
		else if (chartState.datatable == null) {
			/* -- temp history chart -- */
			if (_chartTypeIndex == 2) {
				chartState.datatable = getJoinDatatables( chart.rateColumn, getTempIn );
				chartState.viewtable = new google.visualization.DataView( chartState.datatable );
				chartState.options = initLineChartOptions( 'Données antérieures sur le centre du tas', null );
			}
			/* -- degree day history chart -- */
			else if (_chartTypeIndex == 3) {
				chartState.datatable = getJoinDatatables( chart.rateColumn, getDegreeDay );
				chartState.viewtable = new google.visualization.DataView( chartState.datatable );
				chartState.options = initLineChartOptions( 'Données antérieures sur degré jour', 'Degrés-jours cumulés (>32\u2103)' );
			}
			// set color option
			chartState.options.series = getOptionsColorHist( chartState.viewtable.getNumberOfColumns() );
		}
		// draw chart
		drawVisualization( chart.elementid );
	}


	/**
	 * Build main datatable
	 * @param  {object} chart: parameters for google chart
	 * @return {object} column properties for datatable
	 */
	function buildDataTable( chart ) {
		var columnsProperty = $.Deferred();
		var datatableProperty = null;
		var chartState = [];

		if (!isExistChart( chart.chartindex )) {
			Papa.parse( '../'+chart.datapath+'?t='+$.now(), {
				download: true,
				delimiter: "\t",
				dynamicTyping: true,
				skipEmptyLines: true,
				worker: true,
				fastMode: true,
				complete: function (results) {
					formatResults( results.data );
					initChart( chart );
					datatableProperty = getTemps( chart.name, chart.colors, chart.columns, results.data );

					// temps
					chartState[0] = {
						charttype: 'LineChart',
						datatable: datatableProperty.datatable,
						viewtable: null,
						options: initLineChartOptions( chart.charttitle, null, chart.colors )
					};
					// temp rate
					if (chart.rateColumn > 0) {
						chartState[1] = {
							charttype: 'ScatterChart',
							datatable: getTempRate( chartState[0].datatable, chart.rateColumn ),
							viewtable: null,
							options: initScatterChartOptions( '', "Variation (\u2103 / heure)", chart.colors )
						};
					}

					// record datatables
					saveChartState( chart.chartindex, chartState, datatableProperty.columnsProperty );
					columnsProperty.resolve( datatableProperty.columnsProperty );
				}
			});
		}
		else {
			// get columns property
			columnsProperty.resolve( _chartStateList[ chart.chartindex ].columnsProperty );
		}

		return columnsProperty.promise();
	}


	/**
	 * Refresh datatable
	 * @param  {object} chart        : parameters for google chart
	 * @param {object} chartTypeIndex: 0 = temps, 1 = rate temp, 2 = temp history, 3 = degree day
	 * @return {object} column properties for datatable
	 */
	function refreshChart( chart, chartTypeIndex ) {
		var columnsProperty = $.Deferred();
		var chartState = null;

		if (chart.chartindex == 0) {
			// init temps chart state
			chartState = getChartState( chart.chartindex, 0 );
			chartState.datatable = null;
			// init temp rate chart state
			chartState = getChartState( chart.chartindex, 1 );
			chartState.datatable = null;

			$.when( buildDataTable( $.extend({}, chart) )).then(
				function (properties) {
					var dtTemps = getChartState( 0, 0 ).datatable;

					if (_rePrintemps.test( dtTemps.getTableProperty( 'name' ))) {
						for (var chartStateIndex = 2; chartStateIndex < 4; chartStateIndex++) {
							chartState = getChartState( chart.chartindex, chartStateIndex );
							// chart history exist
							if (chartState.datatable != null) {
								var dt1ColumnIndexes = [];
								var dt = null;

								// remove last column
								chartState.datatable.removeColumn( chartState.datatable.getNumberOfColumns()-1 );
								dt1ColumnIndexes = [...Array( chartState.datatable.getNumberOfColumns()	).keys()];
								dt1ColumnIndexes.shift();
								// get new column
								dt = (chartStateIndex == 2) ?
									getTempIn( dtTemps, chart.rateColumn ) :
									getDegreeDay( dtTemps, chart.rateColumn );
								// join new column to history datatable
								chartState.datatable = google.visualization.data.join( chartState.datatable, dt, 'full', [[0,0]], dt1ColumnIndexes, [1] );
								chartState.viewtable = new google.visualization.DataView( chartState.datatable );
							}
						}
					}
					columnsProperty.resolve( properties );
				}
			);
		}
		else {columnsProperty.resolve( null );}

		return columnsProperty.promise();
	}


	/**
	 * Initialize chart object
	 * @param {object} chart: chart object
	 */
	function initChart( chart ) {
		chart.charttitle = chart.charttitle || 'Température du compost';
		chart.columns = chart.columns.split(',');
		chart.colors = chart.colors.split(',');
		chart.offset = parseInt( chart.offset ) || 0;
		chart.elementid = chart.elementid || 'chart_div';
	}


	/**
	 * Format date column to date object and annotation column empty string to null
	 * @param {array} data: data rows from papaparse
	 */
	function formatResults( data ) {
		// convert first element of each row into date
		$.map( data, function (row) {
			row[0] = new Date( row[0] );
		});

		// annotation column, convert empty string to null
		for (var cols = 1, numOfColumns = data.length; cols < numOfColumns; cols++) {
			if (typeof (data[0][cols]) == 'string') {
				$.map( data, function (row) {
					row[cols] = (row[cols] == '') ? null : row[cols];
				});
			}
		}
	}


	/**
	 * Save chart state
	 * @param {integer} chartindex     : entry key
	 * @param {integer} chartState     : chart state
	 * @param {integer} columnsProperty: column properties
	 */
	function saveChartState( chartindex, chartState, columnsProperty ) {

		if (!(chartindex in _chartStateList)) {
			// new chart state
			_chartStateList[ chartindex ] = {
				'columnsProperty': columnsProperty,
				'chartState': chartState
			};
		}
		else {
			// update chart state
			getChartState( chartindex, 0 ).datatable = chartState[0].datatable;
			getChartState( chartindex, 1 ).datatable = chartState[1].datatable;
		}
	}


	/**
	 * Get chart state
	 * @param {integer}  chartIndex    : key for chart
	 * @param {integer}  chartTypeIndex: 0 = temps, 1 = rate temp, 2 = temp history, 3 = degree day
	 * @return {object} chart state
	 */
	function getChartState( chartIndex, chartTypeIndex ) {
		chartTypeIndex = chartTypeIndex || 0;

		return (chartTypeIndex < 2) ?
			_chartStateList[ chartIndex ].chartState[ chartTypeIndex ] :
			_chartStateHist[ chartTypeIndex-2 ];
	}


	/**
	 * Test if a chart was already processed
	 * @param {integer}  chartIndex    : key for chart
	 * @param {integer}  chartTypeIndex: 0 = temps, 1 = rate temp, 2 = temp history, 3 = degree day
	 * @return {boolean} chart exist
	 */
	function isExistChart( chartIndex, chartTypeIndex ) {
		var isExist = false;
		var datatable = null;
		chartTypeIndex = chartTypeIndex || 0;

		if (chartTypeIndex < 2) {
			// _chartStateList
			isExist = (chartIndex in _chartStateList) ?
				(getChartState( chartIndex, chartTypeIndex ).datatable != null) :
				false;
		}
		else {
			// _chartStateHist
			datatable = getChartState( chartIndex, chartTypeIndex ).datatable;
			isExist = (datatable != null) ? true : false;
		}

		return isExist;
	}


	/**
	 * Initialize data table
	 * @param {string} name    : datatable name
	 * @param {string} colors  : list of serie color
	 * @param {array}  columns : list of column label
	 * @param {array}  datarows: data rows
	 * @return {object} datatable object + columnsProperty
	 */
	function getTemps( name, colors, columns, datarows ) {
		var colorsIndex = 0;
		var hideColumnIndexes = [];
		var columnsProperty = [];
		var row = datarows[0];
		var numOfColumns = row.length;
		var datatable = new google.visualization.DataTable();
		var dateformatter = new google.visualization.DateFormat( {pattern: "yyyy/MM/dd H:mm"} );
		var tempformatter = new google.visualization.NumberFormat( {pattern: "#.##\u2103"} );

		// create columns for datatable
		for (var cols = 0; cols < numOfColumns; cols++) {
			var type = typeof( row[ cols ] );
			var columnLabel = columns[ cols ].trim() || '';
			var column = {label: columnLabel};

			if (type == 'object' && !(row[ cols ] === null)) {
				// date column
				datatable.addColumn( {type: 'datetime', label: columnLabel} );
				// for column date, record last date
				column.lastDate = datarows[ datarows.length-1 ][ cols ];
			}
			else if (type == 'number') {
				// number column
				datatable.addColumn( {type: 'number', label: columnLabel} );
				// for column number, record color + last value
				column.color = colors[ colorsIndex++ ];
				column.lastValue = datarows[ datarows.length-1 ][ cols ];
			}
			else if (type == 'string') {
				// annotation column
				datatable.addColumn( {type: 'string', label: columnLabel, role: 'annotation'} );
			}
			else {
				// annotation column if type is unknown
				datatable.addColumn( {type: 'string', label: columnLabel, role: 'annotation'} );
			}

			// record the column property
			columnsProperty.push( column );
		}

		// add rows
		datatable.addRows( datarows );

		colorsIndex = 0;
		// apply format for datatable
		for (var cols = 0; cols < numOfColumns; cols++) {
			var type = datatable.getColumnType( cols );
			var columnLabel = datatable.getColumnLabel( cols );

			if ((/hide.*/i).test( columnLabel )) {
				// record hide column index for view
				hideColumnIndexes.push( cols );
				if (type == 'number') {
					// remove color serie
					colors.splice( colorsIndex, 1 );
				}
			}
			else if (type == 'datetime' || type == 'date') {
				// format date column
				dateformatter.format( datatable, cols );
			}
			else if (type == 'number') {
				// format number column
				tempformatter.format( datatable, cols );
				colorsIndex++;
			}
		}

		// set datatable properties
		datatable.setTableProperties( {'name': name, 'hideColumnIndexes': hideColumnIndexes} );

		return {datatable: datatable, columnsProperty: columnsProperty};
	}


	/**
	 * Initialize datatable for temp rate
	 * @param {object}  dtTemps   : temps datatable
	 * @param {integer} rateColumn: column index to compute rate
	 * @return {object}	datatable object
	 */
	function getTempRate( dtTemps, rateColumn ) {
		var view = new google.visualization.DataView( dtTemps );
		var columnRateTemp = {
			calc: computeRate,
			type:'number',
			label: dtTemps.getColumnLabel( rateColumn )
		};
		var rateformatter = new google.visualization.NumberFormat( {pattern: "#.##\u2103/hr"} );

		// viewtable containing temp rate
		view.setColumns( [0, columnRateTemp] );

		// compute temp rate on each row
		function computeRate( datatable, row ) {
			var deltaTime = 0, deltaTemp = 0, result = 0;
			var step = 3;

			if (row >= step) {
				deltaTime = datatable.getValue( row, 0 ) - datatable.getValue( row-step, 0 );
				deltaTemp = datatable.getValue( row, rateColumn ) - datatable.getValue( row-step, rateColumn );
				result = (deltaTemp/deltaTime)*3600000;
			}
			return result;
		}

		var datatable = view.toDataTable();
		rateformatter.format( datatable, 1 );

		return datatable;
	}


	/**
	 * Initialize data table for temp in
	 * @param {object}  dtTemps     : temps datatable
	 * @param {integer} rateColumn  : column index of internal temp
	 * @param {date}    dateRelative: relative date
	 * @return {object} datatable object
	 */
	function getTempIn( dtTemps, rateColumn, dateRelative ) {
		var view = new google.visualization.DataView( dtTemps );
		var newDate = {
			calc: normalizeDate,
			type:'datetime',
			label: dtTemps.getColumnLabel( 0 )
		};

		// viewtable temp in
		(dateRelative == null) ?
			view.setColumns( [0, rateColumn] ) :
			view.setColumns( [newDate, rateColumn] );

		// compute new date normalized
		function normalizeDate( datatable, row ) {
			return new Date( datatable.getValue( row, 0 ).getTime() + dateRelative);
		}

		var datatable = view.toDataTable();
		datatable.setColumnLabel( 1, dtTemps.getTableProperty( 'name' ));

		return datatable;
	}


	/**
	 * Initialize data table for temp rate
	 * @param {object}  dtTemps     : temps datatable
	 * @param {integer} rateColumn  : column index of internal temp
	 * @param {date}    dateRelative: relative date
	 * @return {object} datatable object
	 */
	function getDegreeDay( dtTemps, rateColumn, dateRelative ) {
		var view = new google.visualization.DataView( dtTemps );
		var newDate = {
			calc: normalizeDate,
			type:'datetime',
			label: dtTemps.getColumnLabel( 0 )
		};
		var columnDegreeDay = {
			calc: computeDegreeDay,
			type:'number',
			label: dtTemps.getTableProperty( 'name' )
		};
		var degreeDay = 0;

		// viewtable degree day
		(dateRelative == null) ?
			view.setColumns( [0, columnDegreeDay] ) :
			view.setColumns( [newDate, columnDegreeDay] );

		// compute new date normalized
		function normalizeDate( datatable, row ) {
			return new Date( datatable.getValue( row, 0 ).getTime() + dateRelative);
		}

		// compute degree day on each row
		function computeDegreeDay( datatable, row ) {
			var deltaTime = 0, deltaValueAvg = 0, result = 0;
			const MSEC_IN_DAY = 60000*60*24;

			if (row > 0) {
				deltaTime = (datatable.getValue( row, 0 ) - datatable.getValue( row-1, 0 )) / MSEC_IN_DAY;
				deltaValueAvg = ((datatable.getValue( row, rateColumn ) + datatable.getValue( row-1, rateColumn )) / 2) - 32;
				result = deltaValueAvg * deltaTime;

				if (result > 0) {degreeDay += result;}
			}

			return degreeDay;
		}

		return view.toDataTable();
	}


	/**
	 * Function to join several datatable
	 * @param {integer}	 rateColumn : column index to compute rate
	 * @param {function} fnDT2		: function to retrieve dt2
	 * @return {object}	 datatable object
	 */
	function getJoinDatatables( rateColumn, fnDT2 ) {
		var dt1 = null, dt2 = null, dtTemps = null;
		var dt1ColumnIndexes = [];
		var dateAbsolute, dateRelative;
		var dateformatter = new google.visualization.DateFormat( {pattern: "yyyy/MM/dd H:mm"} );

		for (var chartIndex in _chartStateList) {
			dtTemps = getChartState( chartIndex, 0 ).datatable;

			// Spring data
			if (_rePrintemps.test( dtTemps.getTableProperty( 'name' ))) {
				if (dt1 == null) {
					// init join datatable to temp rate
					dt1 = fnDT2( dtTemps, rateColumn );
					dateAbsolute = new Date( dt1.getValue(0, 0).getTime() );
				}
				else {
					// join datatable
					dt1ColumnIndexes = [...Array( dt1.getNumberOfColumns()	).keys()];
					dateRelative = dateAbsolute - dtTemps.getValue(0, 0);

					dt1ColumnIndexes.shift();
					dt2 = fnDT2( dtTemps, rateColumn, dateRelative );
					dt1 = google.visualization.data.join( dt2, dt1, 'full', [[0,0]], [1], dt1ColumnIndexes );
				}
			}
		}

		dateformatter.format( dt1, 0 );
		return dt1;
	}


	/**
	 * Options for google chart line
	 * @param {string} chartTitle: google chart title
	 * @param {string} vAxisTitle: google chart vaxis title
	 * @param {array}  colors	 : list of serie color
	 * @return {object} google chart line options
	 */
	function initLineChartOptions( chartTitle, vAxisTitle, colors ) {
		var options = {
			title: chartTitle,
			legend: {position: "top", alignment: "center"},
			vAxis: {
				title: (vAxisTitle || "Température (\u2103)"),
				viewWindowMode: 'maximized',
				gridlines: {count: 7}
			},
			hAxis: {
				viewWindowMode: 'maximized',
				gridlines: {
					count: -1,
					units: {
						days: {format: ["dd MMM"]},
						hours: {format: ["HH:mm", "ha"]}
					}
				}
			},
			interpolateNulls: true,
			annotations: {textStyle: {color: 'black', italic: true, highContrast: true}},
			chartArea: {width: '85%', height: '75%'},
			height: $('figure.graph').width()/2
		};

		if (colors != null) {
			options.series = colors.map( function(color) { return {'color': color}; });
		}

		return options;
	}


	/**
	 * Options for google chart scatter
	 * @param {string} chartTitle: google chart title
	 * @param {string} vAxisTitle: google chart vaxis title
	 * @param {array}  colors	 : list of serie color
	 * @return {object} Google chart scatter options
	 */
	function initScatterChartOptions( chartTitle, vAxisTitle, colors ) {
		var options = initLineChartOptions( chartTitle, vAxisTitle, colors );

		options.vAxis.viewWindow = {min: -2, max: 2}
		options.pointSize = 1;

		return options;
	}



	/**
	 * Generate color option for history chart
	 * @param {integer} numOfColumns: number of columns in a datatable
	 * @return {object} color serie option
	 */
	function getOptionsColorHist( numOfColumns ) {
		var colors = '#C0C0C0,'.repeat( numOfColumns - 2 )

		colors = colors.concat('#dc3912').split(",");
		colors = colors.map( function (color) { return {'color': color}; });

		return colors;
	}


	/**
	 * Update options for chart
	 * @param {object} chart: parameters for google chart
	 */
	function updateOptions( chart ) {
		var chartState = getChartState( chart.chartindex, 0 );
		var columnsProperty = _chartStateList[ chart.chartindex ].columnsProperty;
		var numOfColumns = chartState.datatable.getNumberOfColumns();
		var hideColumnIndexes = [];
		var colorsIndex = 0;

		for (var cols = 1; cols < numOfColumns; cols++) {
			var type = chartState.datatable.getColumnType( cols );
			var columnLabel = chart.columns[ cols ];

			// update datatable label
			chartState.datatable.setColumnLabel( cols, columnLabel );
			// update columnsProperty label
			columnsProperty[ cols ].label = columnLabel;

			if ((/hide.*/i).test( columnLabel )) {
				// record hide column index for view
				hideColumnIndexes.push( cols );
				if (type == 'number') {
					// remove color serie
					var color = chart.colors.splice( colorsIndex, 1 );
					// update columnsProperty color
					columnsProperty[ cols ].color = color;
				}
			}
			else if (type == 'number') {
				// update columnsProperty color
				columnsProperty[ cols ].color = chart.colors[ colorsIndex ];
				colorsIndex++;
			}
		}
		// set new color series
		chartState.options.series = chart.colors.map( function (color) { return {'color': color}; });
		// set column indexes to hide for view
		chartState.datatable.setTableProperty('hideColumnIndexes', hideColumnIndexes);
	}


	/**
	 * Initialize options for y-axis range
	 * @param {object} options: datatable options
	 * @param {object} view   : temps viewtable
	 * @return {object} google chart options
	 */
	function initOptionsRangeY( options, view ) {
		var cols = view.getNumberOfColumns();
		var min = [], max = [];

		// find list of min/max value for each serie
		for (var index = 0; index < cols; index++) {
			if (view.getColumnType( index ) == 'number') {
				min.push( view.getColumnRange( index ).min );
				if (view.getColumnRange( index ).max < 900) {
					max.push( view.getColumnRange( index ).max );
				}
			}
		}

		min = Math.min(...min);
		max = Math.max(...max);
		options.vAxis.viewWindow = {min: Math.floor(min/10)*10, max: Math.ceil(max/10)*10}

		return options;
	}


	/**
	 * Create a view table which contains filter data from data table
	 * @param {object}  datatable: main datatable
	 * @param {integer} offset   : number of days to filter
	 * @param {integer} date     : max date
	 * @return {array} min/max index
	 */
	function getFilteredRowIndexes( datatable, offset, date ) {
		var mindate = datatable.getValue( 0, 0 );
		var maxdate = datatable.getValue( datatable.getNumberOfRows()-1, 0 );
		var filteredRows = [];

		if (date != null) {
			maxdate = date;
		}
		else if (offset < 0) {
			// calculate mindate date from maxdate
			mindate = new Date( maxdate.getTime() );
			mindate.setDate( mindate.getDate() + offset );
		}
		else if (offset > 0) {
			// calculate maxdate date from mindate
			maxdate = new Date( mindate.getTime() );
			maxdate.setDate( maxdate.getDate() + offset );
		}

		filteredRows = datatable.getFilteredRows( [{column: 0, minValue: mindate, maxValue: maxdate}] );

		return [filteredRows[0], filteredRows[ filteredRows.length-1 ]];
	}


	/**
	 * Get filtered viewtable from datatable
	 * @param {object} datatable        : datatable before filtered viewtable
	 * @param {array} filteredRowIndexes: array of index row for min/max
	 * @return {object} viewtable
	 */
	function getFilteredViewtable( datatable, filteredRowIndexes ) {
		var view = new google.visualization.DataView( datatable );
		var hideColumnIndexes = datatable.getTableProperty( 'hideColumnIndexes' );

		// hide columns
		if (hideColumnIndexes.length > 0) {
			view.hideColumns( hideColumnIndexes );
		}
		// set filtered rows
		view.setRows( filteredRowIndexes[0], filteredRowIndexes[1] );

		return view;
	}


	/**
	 * draw chart
	 * @param {string} elementid: chart element container
	 */
	function drawVisualization( elementid ) {
		var chartState = getChartState( _chartIndex, _chartTypeIndex );
		var divHeight = $('figure.chart').width()/2;

		if (_chartWrapper == null) {
			_chartWrapper = new google.visualization.ChartWrapper( {containerId: elementid || 'chart_div'} );
		}
		_chartWrapper.setChartType( chartState.charttype );
		_chartWrapper.setDataTable( chartState.viewtable );
		_chartWrapper.setOptions( chartState.options );

		// update height
		$('#chart_div').height( divHeight );
		_chartWrapper.setOption( 'height', divHeight );

		_chartWrapper.draw();
	}


	// timeout event handler on windows resize
	$(window).resize( function() {
		if (this.resizeTO) {
			clearTimeout( this.resizeTO );
		}
		this.resizeTO = setTimeout( resizeEndTrigger, 200 );
	});

	// event trigger for resizeEnd
	function resizeEndTrigger() {
		var divHeight = $('figure.chart').width()/2;
		var optHeight = getChartState( _chartIndex, _chartTypeIndex ).options.height;

		// draw on resize when enough change in width px
		if (Math.abs( divHeight - optHeight ) >= 10) {
			divHeight = $('figure.chart').width()/2;
			$('#chart_div').height( divHeight );
			_chartWrapper.setOption( 'height', divHeight );

			_chartWrapper.draw();
		}
	}


	/*** public alias for function ***/
	return {
		buildDataTable: buildDataTable,
		buildChart: buildChart,
		refreshChart: refreshChart,
		isExistChart: isExistChart,
		updateOptions: updateOptions
	};
}();
