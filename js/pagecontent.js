/**
 * Generate random images for header background
 */
$( document ).ready( function() {
	$('#chart_div').height( $('figure.chart').width()/2 );
	pagecontent.showSpinner();

	if (location.pathname.substring(1).match(/graph*/) === null) {
		// list of image background filename
		const _headers = ['01.JPG', '02.JPG', '03.JPG', '04.JPG', '05.JPG', '06.JPG'];

		$('body').css({'background': 'url(../img/headers/' + _headers[Math.floor(Math.random() * _headers.length)] + ') #fff top center no-repeat fixed'});
	}
});


pagecontent = function() {
	const _rePrintemps = /\bprintemps\b ?(\d+)?/i;
	const _elementid = {
		chartlist: '#chartlist',
		filterlist: '#filterlist',
		charttypelist: '#charttypelist',
		refreshbtn: '#refreshbtn',
		modal: '#modal_div',
		templabel: '#tempLabel',
		columns: '#columns',
		loader: '#loader',
		chart: '#chart_div'
	};
	var _isGraphFullscreen = false;
	var _articles = [];
	var _chart = null;


	/**
	 * ajax call to download the xml file which contains page content
	 * @param {object} chart: chart object containing google chart parameters
	 */
	function loadPageContent( chart ) {
		_isGraphFullscreen = (chart == null) ? false : true;

		$.get( "../content.xml", {"_": $.now()}, function( xml ) {
			xmlparse( xml );
		})
		.done( function() {
			// init chart from url param or xml
			_chart = chart || getChart(0);
			// set option content
			initAllChartInputs();
			// set content
			(_isGraphFullscreen) ? setChart( _chart, 0, true ) : setPageContent( getArticle(0) );
		})
		.fail( function() {
			alert( "There is a problem locating content.xml" );
		});
	}


	/**
	 * Parse xml to generate a collection of article object
	 * @param {string} xml : xml file content
	 */
	function xmlparse( xml ) {
		$(xml).find("article").each( function (chartIndex) {
			// article for html page
			var article = {
				title: $(this).find("title").text(),
				desc: $(this).find("description").text(),
				date: $(this).find("date").text()
			};

			var $chart = $(this).find("chart");

			// parameters for google chart
			article.chart = {
				name: $(this).find("title").attr('name'),
				chartindex: chartIndex,
				datapath: $chart.find("datapath").text(),
				charttitle: $chart.find("charttitle").text(),
				columns: $chart.find("columns").text(),
				colors: $chart.find("colors").text(),
				offset: parseInt( $chart.find("offset").text() ),
				rateColumn: parseInt( $chart.find("rateColumn").text() )
			};

			// push new article object into the array
			_articles.push( article );
		});
	}


	/**
	 * Get article object
	 * @param {integer} articleIndex : article index
	 * @return {object} article object
	 */
	function getArticle( articleIndex ) {
		return _articles[ articleIndex ];
	}


	/**
	 * Get chart object
	 * @param {integer} chartIndex : chart index
	 * @return {object}: chart object
	 */
	function getChart( chartIndex ) {
		return getArticle( chartIndex ).chart;
	}


	/**
	 * Set article content
	 * @param {object} article: article object
	 */
	function setPageContent( article ) {
		$("#title").text( article.title );
		$("#desc").text( article.desc );
		$("#date").text( article.date );

		setChart( article.chart, 0, true );
	}


	/**
	 * Set google chart
	 * @param {object}	chart         : chart object containing google chart parameters
	 * @param {integer} chartTypeIndex: 0 = temps, 1 = rate temp, 2 = temp history, 3 = degree day
	 * @param {boolean} isNewDatatable: is request for processing new datatable (chart menu event)
	 */
	function setChart( chart, chartTypeIndex, isNewDatatable ) {
		// generate link for full screen
		if (!_isGraphFullscreen) setChartURL( chart );

		$.when( googlechart.buildDataTable( $.extend({}, chart) ) ).then(
			function (columnsProperty) {
				if (isNewDatatable) {
					// init temperature label and column properties in option
					setColumnProperties( columnsProperty );
				}
				// draw chart
				googlechart.buildChart( $.extend({}, chart), chartTypeIndex );
				// hide spinner
				hideSpinner();
			}
		);
	}


	/**
	 * Set google chart url
	 * @param {object} chart: chart object
	 */
	function setChartURL( chart ) {
		// generate link for full screen
		var url = "graph.html?"+$.param( chart );
		$("#graphurl").attr( {"href" : url} );
	}


	/**
	 * Initialize all inputs for google chart
	 */
	function initAllChartInputs() {
		initChartsMenu( _articles );
		initFilterMenu( _chart.offset );
		initChartTypeMenu();
		resetRefreshEvent();

		// event for modal apply button
		$('#saveOptions').on('click', function() {
			var labels = $.map( $('input.columnLabel'), function (input) {return input.value});
			var colors = $.map( $('input.color'), function (input) {return input.value});
			var chartNewOptions = $.extend({}, _chart);

			// set new options
			chartNewOptions.colors = colors;
			chartNewOptions.columns = labels;
			// stringify new options
			_chart.colors = colors.toString();
			_chart.columns = labels.toString();

			// update new options
			googlechart.updateOptions( $.extend({}, chartNewOptions) );

			// display graph with new options
			setChart( _chart, 0, true );
			resetFilterMenu(0);
			resetChartTypeMenu();
			$(_elementid.modal).modal( 'hide' );
		});
	}


	/**
	 * Set column properties in option
	 * @param {object} columnsProperty: data columns property
	 */
	function setColumnProperties( columnsProperty ) {
		initTempLabel( columnsProperty );
		initColumnsProperties( columnsProperty );
	}


	/**
	 * Redirect page with new parameters
	 * @param {object} chart: chart object
	 */
	function redirectPage( chart ) {
		var url = location.origin + location.pathname +'?';
		window.location.href = url+ $.param( chart );
	}


	/**
	 * Initialize temperature label in options
	 * @param {object} columnsProperty: data columns property
	 */
	function initTempLabel( columnsProperty ) {
		var lastDate = columnsProperty[0].lastDate.toLocaleString("fr-FR");

		$('label[for=tempLabel]').empty();
		$('label[for=tempLabel]').append("Derniers relevés de temperature<br/><span style='font:.8em Georgia,serif;font-style:italic'>"+lastDate+"</span>");

		$(_elementid.templabel).empty();
		for (var cols = 0, numOfColumns = columnsProperty.length; cols < numOfColumns; cols++) {
			var label = columnsProperty[ cols ].label;

			if ('lastValue' in columnsProperty[ cols ] && !(/hide.*/i).test( label )) {
				var color = columnsProperty[ cols ].color;
				var value = columnsProperty[ cols ].lastValue;
				var html = "<a href='#' class='btn btn-default' style='color:white; background-color:"+color+"'><h6><b>"+value+"&#x2103;</b><br/><i>"+label+"</i></h6></a>";
				$(_elementid.templabel).append( html );
			}
		}
	}


	/**
	 * Initialize columns properties in options
	 * @param {object} columnsProperty: data columns property
	 */
	function initColumnsProperties( columnsProperty ) {
		$(_elementid.columns).empty();
		var html = "<table class='table table-striped'> \
						<thead> \
							<tr> \
								<th>#</th> \
								<th>Colonnes</th> \
								<th>Couleurs</th> \
							</tr> \
						</thead>";
		html += "<tbody>"

		for (var cols = 0, numOfColumns = columnsProperty.length; cols < numOfColumns; cols++ ) {
			html += "<tr>";
			html += "<th scope='row'>"+ (cols+1) +"</th>";

			// label column
			html += "<td><input type='text' class='form-control columnLabel' value='"+columnsProperty[cols].label+"'></td>"
			// column for serie color
			html += ('color' in columnsProperty[ cols ]) ?
				"<td><input type='text' class='form-control color' value="+ columnsProperty[cols].color +"></td>" : "<td></td>";
			html += "</tr>"
		}

		html += "</tbody></table>"

		$(_elementid.columns).empty();
		$(_elementid.columns).append( html );
		// disable date column
		$($('input.columnLabel')[0]).attr('disabled', 'disabled');
		// set color picker
		$('input.color').colorPicker();
	}


	/**
	 * Set event handler for refresh button
	 */
	function setRefreshEvent() {
		var chartTypeIndex = $(_elementid.charttypelist).val();

		showSpinner();
		$('fieldset#refreshbtn > label i').addClass( 'fa-spin' );

		$.when( googlechart.refreshChart( $.extend({}, _chart), chartTypeIndex )).then(
			function (columnsProperty) {
				if (columnsProperty != null) {initTempLabel( columnsProperty );}
				googlechart.buildChart( $.extend({}, _chart), chartTypeIndex );

				hideSpinner();
				$('fieldset#refreshbtn > label i').removeClass( 'fa-spin' );
			}
		);
	}


	/**
	 * Reset event handler for refresh button
	 */
	function resetRefreshEvent() {
		var chartIndex = $(_elementid.chartlist).val() || _chart.chartindex;
		var selectedChartMenu = $(_elementid.chartlist+" option:selected").text();
		const refreshbtn = "<i class='fa fa-refresh' aria-hidden='true'></i>";

		if (chartIndex == 0) {
			$(_elementid.refreshbtn).on( "click", setRefreshEvent);
			$('fieldset#refreshbtn > label').append( refreshbtn );
		}
		else {
			$(_elementid.refreshbtn).off( "click");
			$('fieldset#refreshbtn > label').empty();
		}
	}


	/**
	 * Set chart menu list
	 * @param {object} articles: article object
	 */
	function initChartsMenu( articles ) {
		// set event handler on change
		$(_elementid.chartlist).change( setChartsMenuEvent );
		// generate new list of options for dropdown menu
		articles.forEach( function( article, index ) {
			$(_elementid.chartlist).append('<option value=' + index + '><h4>' + article.chart.name + '</h4></option>');
		});
		// set default selection
		$(_elementid.chartlist).val( _chart.chartindex );
	}


	/**
	 * Set event handler for chart menu
	 */
	function setChartsMenuEvent() {
		// get selected value
		var index = this.value;

		// get current graph
		_chart = getChart( index );

		if (_isGraphFullscreen) {
			redirectPage( _chart );
		}
		else {
			showSpinner();
			setPageContent( getArticle( index ));

			resetRefreshEvent();
			resetFilterMenu( _chart.offset );
			resetChartTypeMenu();
		}
	}


	/**
	 * Set filter menu list
	 * @param {integer} offset: number of days to filter
	 */
	function initFilterMenu( offset ) {
		// set event handler on change
		$(_elementid.filterlist).change( setFilterMenuEvent );
		// reset filter menu
		resetFilterMenu( offset );
	}


	/**
	 * Set event handler for filter menu
	 */
	function setFilterMenuEvent() {
		var charTypeIndex = $(_elementid.charttypelist).val();

		showSpinner();

		_chart.offset = parseInt( this.value );
		setChart( _chart, charTypeIndex, false );
	}


	/**
	 * Reset filter menu selection
	 * @param {integer} offset: number of days to filter
	 */
	function resetFilterMenu( offset ) {
		var filterMenu = $(_elementid.filterlist)[0].options;
		var filterValues = $.map( filterMenu, function (elem) {
			return (elem.value || elem.text);
		});
		var value = 0;

		for (var item in filterValues) {
			if ( filterValues[item] >= offset ) {
				value = filterValues[item];
				break;
			}
		}

		// set selected value
		$(_elementid.filterlist).val( value );
		// enable filter menu
		$(_elementid.filterlist).removeAttr('disabled');
	}


	/**
	 * Set chart type menu list
	 */
	function initChartTypeMenu() {
		// need to reset chart menu
		resetChartTypeMenu();
		// set chart menu event
		$(_elementid.charttypelist).change( setChartTypeMenuEvent);
	}


	/**
	 * Set event handler for chart type menu
	 */
	function setChartTypeMenuEvent() {
		var countChartProcessed = 0;
		var isAllSpringProcessed = $.Deferred();
		var chart = null;
		var chartTypeIndex = parseInt( this.value );

		showSpinner();

		if (chartTypeIndex > 1) {
			// disable filter menu when select history chart
			$(_elementid.filterlist).attr( 'disabled', 'disabled' );
			// chart never processed
			if (!googlechart.isExistChart( _chart.chartindex, chartTypeIndex )) {
				// iterate all charts
				for (var chartIndex = 0, numOfCharts = _articles.length; chartIndex < numOfCharts; chartIndex++) {
					// only process for spring chart
					if (_rePrintemps.test( _articles[ chartIndex ].chart.name )) {
						chart = getChart( chartIndex );
						$.when( googlechart.buildDataTable( $.extend({}, chart) )).then(
							function (x) {
								countChartProcessed++;
								// if process last spring chart, resolve
								if (countChartProcessed == numOfCharts) {
									isAllSpringProcessed.resolve(true);
								}
							}
						);
					}
					else {countChartProcessed++;}
				}
			}
			else {isAllSpringProcessed.resolve( true );}
		}
		else {
			// enable filter menu
			$(_elementid.filterlist).removeAttr( 'disabled' );
			isAllSpringProcessed.resolve( true );
		}

		// when all spring datatables are processed
		$.when( isAllSpringProcessed ).then(
			function (x) {
				setChart( _chart, chartTypeIndex, false );
			}
		);
	}


	/**
	 * Reset chart type menu selection
	 */
	function resetChartTypeMenu() {
		var selectedChartMenu = $(_elementid.chartlist+" option:selected").text();

		// set default selection
		$(_elementid.charttypelist).val( 0 );
		// disable/enable chart menu when graph menu is not spring
		_rePrintemps.test( selectedChartMenu ) ?
			$(_elementid.charttypelist).removeAttr( 'disabled' ) :
			$(_elementid.charttypelist).attr( 'disabled', 'disabled' );
	}


	/**
	 * Show spinner animation
	 */
	function showSpinner() {
		var divHeight = $('figure.chart').width()/4;

		$( _elementid.loader ).show();
		$( _elementid.loader ).css( 'margin-top', divHeight-30 );
		$( _elementid.chart ).css( 'margin-top', -divHeight );
		$( _elementid.chart ).css( {
			'opacity': 0.4,
			'-webkit-transition': 'opacity 0.5s',
			'transition': 'opacity 0.5s'
		});
	}


	/**
	 * Hide spinner animation
	 */
	function hideSpinner() {
		$( _elementid.loader ).hide();
		$( _elementid.chart ).css( 'margin-top', 0 );
		$( _elementid.chart ).css( {
			'opacity': 1,
			'-webkit-transition': 'opacity 0.5s',
			'transition': 'opacity 0.5s'
		});
	}


	/*** public alias for function ***/
	return {
		loadPageContent: loadPageContent,
		showSpinner: showSpinner
	};
}();
