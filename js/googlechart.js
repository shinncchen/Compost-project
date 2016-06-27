googlechart = function() {

	// variable for Google line chart
	var _columnsProperty = null;
	var _data = null;
	var _dataDelta = null;
	var _listOfChartsParam = null;
	var _chartIndex = 0;
	var _chartWrapper = null;
	var _filteredRows = null;


	/**
	 * function to parse csv file + call draw chart
	 * @param {object} graph: parameters for google chart
	 */
	function buildChart( graph ) {
		// parse the cvs file through ajax
		Papa.parse( '../'+graph.datapath, {
			download: true,
			delimiter: "\t",
			dynamicTyping: true,
			skipEmptyLines: true,
			worker: true,
			fastMode: true,
			complete: function( results ) {

				// reformat results.data
				formatResults( results.data );
				// initialize graph parameters
				initParams( graph );
				// initialize global variables
				initGlobalVariables( graph );
				// initialize main datatable
				_data = initDatatable( graph.colors, graph.columns, results.data );
				// initialize options
				_listOfChartsParam[0].options = initLineChartOptions( graph.graphtitle, graph.colors );
				_listOfChartsParam[1].options = initScatterChartOptions( '', graph.colors );
				// set views + draw google charts
				setChart( graph.deltaColumn, graph.offset, _chartIndex );
				// trigger windows event for end of callback
				$(window).trigger('endOfCallback');
			}
		});
	}


	/**
	 * Format date column to date object and annotation column empty string to null
	 * @param {object} data: data rows parse from csv file
	 */
	function formatResults( data ) {
		// convert first element of each row into date
		$.map( data, function( row ) { row[0] = new Date( row[0] ); } );

		// annotation column, convert empty string to null
		for (cols = 1; cols < data.length; cols++) {
			if (typeof( data[0][cols] ) == 'string') {
				$.map( data, function( row ) {
					row[ cols ] = (row[ cols ] == '') ? null : row[ cols ];
				});
			}
		}
	}


	/**
	 * Initialize global variables
	 * @param {object} graph: parameters for google chart
	 */
	function initGlobalVariables( graph ){
		_columnsProperty = [];
		// main datatable
		_data = null;
		// delta C/hr datatable
		_dataDelta = null;
		// list of charts
		_listOfChartsParam = [
			{charttype: 'LineChart', view: null, options: null},
			{charttype: 'ScatterChart', view: null, options: null}
		];
		// index of charts it draw previously
		_chartIndex = 0;
		// google ChartWarper
		_chartWrapper = new google.visualization.ChartWrapper( {containerId: graph.elementid} );
		// filtered row indexes
		_filteredRows = null;
	}


	/**
	 * Initialize parameters from function call
	 * @param {object} graph: parameters for google chart
	 */
	function initParams( graph ) {
		// initialize graph title
		graph.graphtitle = graph.graphtitle || 'Température du compost';
		// initialize graph column headers
		graph.columns = graph.columns.split(',');
		// initialize colors
		graph.colors = graph.colors.split(',');
		// initialize offset in number of days
		graph.offset = parseInt( graph.offset ) || 0;
		// initialize html element id for chart container
		graph.elementid = graph.elementid || 'chart_div';
	}


	/**
	 * Get column property from data rows
	 */
	function getColumnsProperty() {
		return _columnsProperty;
	}


	/**
	 * Initialize data table
	 * @param {string} colors  : list of serie color
	 * @param {array}  columns : list of column label
	 * @param {array}  datarows: data rows
	 * @return {object} datatable object
	 */
	function initDatatable( colors, columns, datarows ) {
		var colorsIndex = 0;
		var row = datarows[0];
		var numOfColumns = row.length;
		var data = new google.visualization.DataTable();
		var dateformatter = new google.visualization.DateFormat( {pattern: "yyyy/MM/dd H:mm"} );
		var tempformatter = new google.visualization.NumberFormat( {pattern: "#.##\u2103"} );

		// create columns for datatable
		for (cols = 0; cols < row.length; cols++) {
			var type = typeof( row[cols] );
			var columnLabel = columns[ cols ].trim() || '';
			var column = {label: columnLabel};

			if (type == 'object' && !(row[cols] === null)) {
				// date column
				data.addColumn( {type: 'datetime', label: columnLabel} );
				// for column date, record last date
				column.lastDate = datarows[ datarows.length-1 ][ cols ];
			}
			else if (type == 'number') {
				// number column
				data.addColumn( {type: 'number', label: columnLabel} );
				// for column number, record color + last value
				column.color = colors[ colorsIndex++ ];
				column.lastValue = datarows[ datarows.length-1 ][ cols ];
			}
			else if (type == 'string') {
				// annotation column
				data.addColumn( {type: 'string', label: columnLabel, role: 'annotation'} );
			}
			else {
				// annotation column if type is unknown
				data.addColumn( {type: 'string', label: columnLabel, role: 'annotation'} );
			}

			// record the column property
			_columnsProperty.push( column );
		}

		// add data rows
		data.addRows( datarows );

		colorsIndex = 0;
		// apply format for datatable
		for (cols = 0; cols < numOfColumns; cols++) {
			var type = data.getColumnType( cols );
			var columnLabel = data.getColumnLabel( cols ).toLowerCase();

			if (columnLabel.match(/hide.*/)) {
				// remove column from datatable
				data.removeColumn( cols-- );
				numOfColumns--;
				if (type == 'number') {
					// remove color serie
					colors.splice( colorsIndex, 1 );
				}
			}
			else if (type == 'datetime' || type == 'date') {
				// format date column
				dateformatter.format( data, cols );
			}
			else if (type == 'number') {
				// format number column
				tempformatter.format( data, cols );
				colorsIndex++;
			}
		}
		return data;
	}


	/**
	 * Options for google line chart
	 * @param {string} graphtitle : google chart title
	 * @param {array}  colors     : list of serie color
	 * @return {object} google line chart options
	 */
	function initLineChartOptions( graphtitle, colors ) {
		// google line chart options
		var options = {
			title: graphtitle,
			legend: { position: "top", alignment: "center" },
			vAxis: {
				title: "Température (\u2103)",
				viewWindowMode: 'explicit',
				viewWindow: { },
				gridlines: { count: 7 }
			},
			hAxis: {
				gridlines: {
					count: -1,
					units: {
						days: { format: ["dd MMM"] },
						hours: { format: ["HH:mm", "ha"] }
					}
				}
			},
			series: colors.map( function(color) { return {'color': color}; }),
			annotations: { textStyle: { color: 'black', italic: true, highContrast: true }},
			//chartArea: { width: '82%', height: '73%' },
			chartArea: { width: '85%', height: '75%' },
			height: $('figure.graph').width()/2
			// animation: { duration: 1500, easing: 'out', startup: true },
		};

		return options;
	}


	/**
	 * Options for google scatter chart
	 * @param {string} graphtitle : google chart title
	 * @param {array}  colors     : list of serie color
	 * @return {object} Google scatter chart options
	 */
	function initScatterChartOptions( graphtitle, colors ) {
		var options = initLineChartOptions( graphtitle, colors );

		options.vAxis.title = "Variation (\u2103 / heure)";
		options.vAxis.viewWindow = {min: -2, max: 2}
		options.pointSize = 1;

		return options;
	}


	/**
	 * Initialize delta datatable
	 * @param {object} deltaColumn : index column delta is computed
	 * @param {object} view        : viewtable from datatable
	 * @return {object}	datatable
	 */
	function initDeltaDatatable( deltaColumn, view ) {
		var deltaData = new google.visualization.DataTable();
		var dateformatter = new google.visualization.DateFormat( {pattern: "yyyy/MM/dd H:mm"} );
		var deltaformatter = new google.visualization.NumberFormat( {pattern: "#.##\u2103/hr"} );

		// create columns
		deltaData.addColumn( {type: 'datetime', label: _data.getColumnLabel(0)} );
		deltaData.addColumn( {type: 'number', label: _data.getColumnLabel( deltaColumn )} );

		// add first row
		deltaData.addRow([view.getValue(0, 0), 0.00]);

		// compute + add remaining rows
		for (row = 3; row < view.getNumberOfRows(); row++) {
			var deltaTime = view.getValue( row, 0 ) - view.getValue( row-3, 0 );
			var deltaTemp = view.getValue( row, deltaColumn ) - view.getValue( row-3, deltaColumn );
			deltaData.addRow( [view.getValue(  row, 0 ), (deltaTemp/deltaTime)*3600000] );
		}

		// apply format column
		dateformatter.format( deltaData, 0 );
		deltaformatter.format( deltaData, 1 );

		return deltaData;
	}


	/**
	 * Initialize options for y-axis range
	 * @return {object} google chart options
	 */
	function initOptionsRangeY( options, view ) {
		var cols = view.getNumberOfColumns();
		var min = [], max = [];

		// find list of min/max value for each serie
		for(index = 0; index < cols; index++) {
			if( view.getColumnType( index ) == 'number' ) {
				min.push( view.getColumnRange( index ).min );
				if (view.getColumnRange( index ).max < 900) {
					max.push( view.getColumnRange( index ).max );
				}
			}
		}

		// get min/max value for all series
		min = Math.min(...min);
		//options.vAxis.viewWindow.min = Math.floor( min - 2  );
		max = Math.max(...max);
		//options.vAxis.viewWindow.max = Math.ceil( max + 10 );

		options.vAxis.viewWindow = {min: min, max: 70}

		return options;
	}


	/**
	 * Create a view table which contains filter data from data table
	 * @param {integer} offset : number of days to filter
	 * @param {integer} date   : date to create range date for zoom
	 */
	function setFilteredRows( offset, date ) {
		var mindate = _data.getValue( 0, 0 );
		var maxdate = _data.getValue( _data.getNumberOfRows()-1, 0 );

		if (offset < 0) {
			// calculate mindate date from maxdate
			mindate = new Date( maxdate.getTime() );
			mindate.setDate( mindate.getDate() + offset );
		}
		else if (offset > 0) {
			// calculate maxdate date from mindate
			maxdate = new Date( mindate.getTime() );
			maxdate.setDate( maxdate.getDate() + offset );
		}

		var filteredRows = _data.getFilteredRows( [{column: 0, minValue: mindate, maxValue: maxdate}] );
		// record range row index [min, max]
		_filteredRows = [filteredRows[0], filteredRows[ filteredRows.length-1 ]];
	}


	/**
	 * Get viewtable, filtered datatable
	 * @return {object} viewtable object
	 */
	function getViewtable() {
		var view = new google.visualization.DataView( _data );

		view.setRows( _filteredRows[0], _filteredRows[1] );
		return view;
	}


	/**
	 * Redraw google chart line on filter call
	 * @param {integer} deltaColumn: index column delta is computed
	 * @param {integer} offset     : number of days to find lower/upper bound date
	 * @param {object}	date       : date
	 */
	function setChart( deltaColumn, offset, chartIndex, date ) {
		var chartOne = _listOfChartsParam[0];
		var chartTwo = _listOfChartsParam[1];

		// create view table
		setFilteredRows( offset, date );
		// initialize first chart view
		chartOne.view = getViewtable();
		// init options ymax
		chartOne.options = initOptionsRangeY( chartOne.options, chartOne.view );
		if (deltaColumn > 0) {
			// initialize second chart view
			chartTwo.view = initDeltaDatatable( deltaColumn, chartOne.view );
		}

		// draw chart
		drawVisualization( chartIndex );
	}

	/**
	 * draw chart
	 * @param {integer} chartIndex: chart index to draw
	 */
	function drawVisualization( chartIndex ) {
		_chartIndex = chartIndex;

		var charttype = _listOfChartsParam[ chartIndex ].charttype;
		var datatable = _listOfChartsParam[ chartIndex ].view;
		var options = _listOfChartsParam[ chartIndex ].options;

		_chartWrapper.setChartType( charttype );
		_chartWrapper.setDataTable( datatable );
		_chartWrapper.setOptions( options );

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
		var divHeight = $('figure.graph').width()/2;
		var optHeight = _listOfChartsParam[ _chartIndex ].options.height;

		// draw on resize when enough change in width px
		if (Math.abs( divHeight - optHeight ) >= 10) {
			_listOfChartsParam[0].options.height = divHeight;
			_listOfChartsParam[1].options.height = divHeight;
			_chartWrapper.setOption( 'height', divHeight );
			_chartWrapper.draw();
		}
	}


	/*** public alias for function ***/
	return {
		buildChart: buildChart,
		getColumnsProperty: getColumnsProperty,
		setChart: setChart,
		draw: drawVisualization};
}();
