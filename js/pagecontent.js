/**
 * Generate random images for header background
 */
$( document ).ready( function() {
	if (location.pathname.substring(1).match(/graph*/) === null) {
		// list of image background filename
		const _headers = ['01.JPG', '02.JPG', '03.JPG', '04.JPG', '05.JPG', '06.JPG'];

		$('body').css({'background': 'url(../img/headers/' + _headers[Math.floor(Math.random() * _headers.length)] + ') #fff top center no-repeat fixed'});
	}
});


pagecontent = function() {
	// list of filter condition in number of days
	const _filters = {'dernier mois': -28, '3 dernières semaines': -21, '2 dernières semaines': -14, 'dernières semaine': -7, '3 derniers jours': -3, 'dernière journée': -1, 'max': 0, 'première journée': 1, '3 premiers jours': 3, 'première semaine': 7, '2 premières semaines': 14, '3 premières semaines': 21, 'premier mois': 28};
	// graph button toggle text
	const _btnchartText = ["\u21B7 Rate \u2103 / hr", "\u21B7 Temp \u2103"];
	// index for graph button toggle text
	var _btnchartIndex = 0;
	// list of element id used
	var _elementid = {filterlist: '#filterlist', graphlist: '#graphlist', labelchart: '#labelchart', btnchart: '#btnchart', modal: '#modal_div', templabel: '#tempLabel', columns: '#columns'};

	// collection of articles
	var _articles = [];
	// index of current article displayed on the page
	var _articlesIndex = 0;
	// graph parameters
	var _graph = null;



	/**
	 * ajax call to download the xml file which contains list of html page content
	 */
	function loadPageContent() {
		$.get( "../content.xml", function( xml ) {
			// parse xml
			xmlparse( xml );
		})
		.done( function() {
			// set list of graph and event handler
			initGraphMenu( _articles );
			// set list of filter and event handler
			initFilterMenu( _filters );
			// set temp labels
			$(window).on( 'endOfCallback', function() {
				initTempLabel( googlechart.getColumnsProperty() );
			});
			// set page content for html page
			setPageContent( getCurrentArticle() );
		})
		.fail( function() {
			// ajax call failed
			alert( "There is a problem locating content.xml" );
		});
	}


	/**
	 * Parse xml to generate a collection of article object which contains html page content
	 * @param {string} xml : xml file content
	 */
	function xmlparse( xml ) {
		$(xml).find("article").each( function() {
			// article for html page
			var article = {
				title: $(this).find("title").text(),
				desc: $(this).find("description").text(),
				date: $(this).find("date").text(),
				name: $(this).find("title").attr('name')
			};

			var $graph = $(this).find("graph");
			// parameters for Google chart line
			article.graph = {
				datapath: $graph.find("datapath").text(),
				graphtitle: $graph.find("graphtitle").text(),
				columns: $graph.find("columns").text(),
				colors: $graph.find("colors").text(),
				offset: parseInt( $graph.find("offset").text() ),
				deltaColumn: parseInt( $graph.find("deltaColumn").text() )
			};

			// push new article object into the array
			_articles.push( article );
		});
	}


	/**
	 * Get article object from the collection
	 * @return {object}: article object
	 */
	function getCurrentArticle() {
		return _articles[_articlesIndex];
	}


	/**
	 * Get graph parameters
	 * @return {object}: graph object
	 */
	function getCurrentGraph() {
		return (_graph) ? _graph : getCurrentArticle().graph;
	}


	/**
	 * Set article content on html page
	 * @param {object} article: article object
	 */
	function setPageContent( article ) {
		// initialize button toggle
		initButtonChart( article.graph.deltaColumn );
		// initialize the filter menu selection
		resetFilterMenu( article.graph.offset );

		$("#title").text( article.title );
		$("#desc").text( article.desc );
		$("#date").text( article.date );

		// set google chart on the html page
		setPageGraph( article.graph );
	}


	/**
	 * Set google chart on html page
	 * @param {object} graph: graph object containing google chart parameters
	 */
	function setPageGraph( graph ) {
		// call google chart to draw object
		google.setOnLoadCallback(  googlechart.buildChart( $.extend({}, graph) ) );
		// generate link for full screen
		setGraphURL( graph );
	}


	/**
	 * Set google chart url
	 * @param {object} graph: graph object containing google chart parameters
	 */
	function setGraphURL( graph ) {
		// generate link for full screen
		var url = "graph.html?"+$.param( graph );
		$("#graphurl").attr( {"href" : url} );
	}


	/**
	 * Set input control on graph.html
	 * @param {object} columnsProperty: data columns property
	 * @param {object} graph: graph object containing google chart parameters
	 */
	function setPageGraphOptions( columnsProperty, graph ) {
		_graph = graph;

		// init button to toggle chart
		initButtonChart( graph.deltaColumn );
		// init filter select menu
		initFilterMenu( _filters );
		// reset filter select menu state
		resetFilterMenu( graph.offset );
		// init temperature label in options
		initTempLabel( columnsProperty );
		// init columns properties in options
		initColumnsProperties( columnsProperty );

		$('#saveOptions').on('click', function() {
			var labels = $.map( $('input.columnLabel'), function(input) {return input.value});
			var colors = $.map( $('input.color'), function(input) {return input.value});

			graph.columns = labels.toString();
			graph.colors = colors.toString();
			redirectPage( graph );
		});
	}


	/**
	 * Redirect page with new parameters
	 * @param {object} graph: graph object containing google chart parameters
	 */
	function redirectPage( graph ) {
		var url = location.origin + location.pathname +'?';
		window.location.href = url+ $.param( graph );
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
		for (cols = 0; cols< columnsProperty.length; cols++) {
			var label = columnsProperty[ cols ].label;

			if ('lastValue' in columnsProperty[ cols ] && !(label == 'hide')) {
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
								<th>Column Label</th> \
								<th>Serie Color</th> \
							</tr> \
						</thead>";
		html += "<tbody>"

		for (cols = 0; cols < columnsProperty.length; cols++ ) {
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
	 * Set graph menu list
	 * @param {object} articles: list of articles for graph menu
	 */
	function initGraphMenu( articles ) {
		// set event handler on change
		$(_elementid.graphlist).change( setGraphMenuEvent );
		$('#graphlist-button > span').hide();

		// generate new list of options for dropdown menu
		articles.forEach( function( article, index ) {
			$(_elementid.graphlist).append('<option value=' + index + '><h4>' + article.name + '</h4></option>');
		});
	}


	/**
	 * Set event handler for graph menu
	 */
	function setGraphMenuEvent() {
		$('#graphlist-button > span').hide();
		_articlesIndex = this.value;
		// set new article content for the html page
		setPageContent( getCurrentArticle() );
	}


	/**
	 * Set filter menu list
	 * @param {object} filters: list of options for filter menu
	 */
	function initFilterMenu( filters ) {
		// set event handler on change
		$(_elementid.filterlist).change( setFilterMenuEvent );
		$('#filterlist-button > span').hide();

		// generate new list of options for dropdown menu
		for (var item in filters) {
			$(_elementid.filterlist).append('<option value=' + filters[item] + '><h4>' + item + '</h4></option>');
		}
	}


	/**
	 * Initialize the filter menu selection
	 * @param {integer} offset : number of days to filter
	 */
	function resetFilterMenu( offset ) {
		var value = 0;

		for (var item in _filters) {
			if ( _filters[item] >= offset ) {
				value = _filters[item];
				break;
			}
		}
		$(_elementid.filterlist).val( value );
	}


	/**
	 * Set event handler for filter menu
	 */
	function setFilterMenuEvent() {
		$('#filterlist-button > span').hide();
		var offset = parseInt( this.value );
		var graph = getCurrentGraph();

		graph.offset = offset;
		googlechart.setChart( graph.deltaColumn, offset, _btnchartIndex );

		(_graph === null) ? setGraphURL( graph ) : $(_elementid.modal).modal('hide');
	}


	/**
	 * Initialize button to toggle chart
	 * @param {integer} deltaColumn : precondition for button
	 */
	function initButtonChart( deltaColumn ) {
		if (deltaColumn > 0) {
			// show chart button
			(_graph === null) ? $(_elementid.labelchart).show() : $(_elementid.btnchart).show();
			// initialize button toggle
			_btnchartIndex = 0;
			$(_elementid.btnchart).text( _btnchartText[_btnchartIndex] );

			// set events
			$(_elementid.btnchart).off().on('click', setButtonChartEvent);
			$('#chart_div').on('swipeleft', setButtonChartEvent);
			$('#chart_div').on('swiperight', setButtonChartEvent);
		}
		else {
			// hide chart button
			(_graph === null) ? $(_elementid.labelchart).hide() : $(_elementid.btnchart).hide();
		}
	}


	/**
	 * Set event handler for button to toggle chart
	 */
	function setButtonChartEvent() {
		_btnchartIndex = (_btnchartIndex + 1) % _btnchartText.length;
		$(this).text( _btnchartText[_btnchartIndex] );
		google.setOnLoadCallback(  googlechart.draw( _btnchartIndex ));
	}


	/*** public alias for function ***/
	return {
		loadPageContent: loadPageContent,
		setPageGraphOptions: setPageGraphOptions};
}();
