const CONFIG_FILE = 'config/data.json';
const SETUP_FILE = '../config/setup.json';
const DEFAULT_STATISTICS_PATH = '../vom-statistics/'

function img(file_name) {
	return '../img/'+file_name;
}

var setup = null;
var config = null;
var answers = null;
var currentThesis = 0;
var timeout = null;
var showSwypeInfo = true;

var alreadyHit = {};  // for statistics: storage for remembering already hit points of the application

// translation instance, see lang/*.js files
var t = new T();

$(function () {
	translate();
	$('#btn-start').prop('disabled', true);

	init();
    initHammer();
});

function translate() {
	for (let prop in t) {
		let id = prop.replace(/_/g, '-');
		$('#' + id).html(t[prop]);
	}
}

function formatURL(url) {
	return (url.substr(-1) != '/') ? url + '/' : url;
}

/**
 * Send notification about hitting this point in the application
 * @param {string} id - Identifier for the point in the application
 * @return 0 if successful, 1 if an error occured
 */
function hit(id) {
	if (alreadyHit[id] 						 // don't count already entered points twice
		|| !setup.statistics 				 // make sure statistics are enabled
		|| setup.statistics.checkpoints[id] === undefined // make sure currently entered point should be tracked in statistics
		) return;
	alreadyHit[id] = true;

	id = setup.statistics.checkpoints[id] || id;
	prefix = config.statistics.group ? config.statistics.group.prefix || '' : '';
	checkpointId = prefix+id;
	const hitUrl = `${formatURL(setup.statistics.url || DEFAULT_STATISTICS_PATH)}hit.php?cp=${encodeURIComponent(checkpointId)}`;
	$.ajax({
		url: hitUrl,
		type: "GET",
		success: (answer) => {
			if (answer !== 'Log successful') {
				$('#global-error-msg').html('<div class="alert alert-danger" role="alert">' + t.error_statistics_general + '</div>');
				console.log(`Statistics Module answers: ${answer}`);
				return 1;
			}

			return 0;
		},
		error: (request, error, exception) => {
			if (request.status === 404) {
				$('#global-error-msg').html('<div class="alert alert-danger" role="alert">' + t.error_statistics_module_not_found + '</div>');
			} else {
				$('#global-error-msg').html('<div class="alert alert-danger" role="alert">' + t.error_statistics_general + '</div>');
			}
			return 1;
		}
	});
}

/**
 * Resets hits when vote-o-mat is restarted without reloading
 */
function initializeHitsOnRestart() {
	alreadyHit.start = false;
	alreadyHit.result = false;
}

function init() {
	$.getJSON(SETUP_FILE)
		.done(function (jsondata) {
			setup = jsondata;
			setBranding(jsondata.branding);
			setActions(jsondata.actions);
		})
		.fail(function () {
			$('#error-msg').html('<div class="alert alert-danger" role="alert">' + t.error_loading_setup_file + '</div>');
		})
		.then(function () {
			$.getJSON(CONFIG_FILE)
				.done(function (jsondata) {
					config = jsondata;
					currentThesis = 0;
					hit('enter');
					initOnclickCallbacks();
					initAnswers();
					initResultDetails();
					recreatePagination();
					loadThesis();
					$('#btn-start').prop('disabled', false);
				})
				.fail(function () {
					$('#error-msg').html('<div class="alert alert-danger" role="alert">' + t.error_loading_config_file + '</div>');
				});
		});
}

function initOnclickCallbacks() {
	$('#swype-info').off('click').click(function () { hideSwypeInfo(); });
	$('#btn-start').off('click').click(function () { showVoteOMat(); });
	$('#btn-start-show-qa').off('click').click(function () { showQA(); });
	$('#btn-toggle-thesis-more').off('click').click(function () { toggleThesisMore(); });
	$('#btn-important').off('click').click(function () { toggleImportant(); });
	$('#btn-yes').off('click').click(function () { doYes(); });
	$('#btn-neutral').off('click').click(function () { doNeutral(); });
	$('#btn-no').off('click').click(function () { doNo(); });
	$('#btn-skip').off('click').click(function () { doSkip(); });
	$('#btn-vote-o-mat-show-start').off('click').click(function () { showStart(); });
	$('#btn-vote-o-mat-show-qa').off('click').click(function () { showQA(); });
	$('#btn-vote-o-mat-skip-remaining-theses').off('click').click(function () { showResults(); });
	$('#btn-results-show-start').off('click').click(function () { showStart(); });
	$('#btn-results-show-qa').off('click').click(function () { showQA(); });
}

function initHammer() {
	var thesisHammer = new Hammer(document.getElementById("thesis-card"));
	thesisHammer.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL });
	thesisHammer.on('swipeleft', nextThesis);
	thesisHammer.on('swiperight', prevThesis);

	var resultHammer = new Hammer(document.getElementById("result-summary-row"));
	resultHammer.on('swiperight', function (ev) {
		showVoteOMat();
	});
}

function setBranding(branding) {
	$('.branding-container').html(getBrandingHTML(branding));
	$('.branding-logo-placeholder').replaceWith(function () {
		return getBrandingLogoHTML(branding, $(this).attr("style"));
	});
}

function setActions(actions) {
	if (!actions) return;
	if (!!actions.top) $('#actions-top').replaceWith(getActionsHTML('top', actions.top));
	if (!!actions.bottom) $('#actions-bottom').replaceWith(getActionsHTML('bottom', actions.bottom));
}

function getBrandingHTML(branding) {
	let brandingText = branding.appendix || "";
	if (!brandingText) return getBrandingLogoHTML(branding, "height: 1.5em; margin-top: -0.25em");
	return `${brandingText} ${getBrandingLogoHTML(branding, "height: 1.5em; margin-top: -0.25em")}`
}

function getBrandingLogoHTML(branding, style="") {
	if (!branding.logo) return "";
	let brandingLogo = `<img src="${img(branding.logo)}" alt="Brand Logo" style="${style}"/>`;

	if (!branding.url) return brandingLogo;

	return `<a href="${branding.url}" title="Website öffnen" target="_blank">${brandingLogo}</a>`;
}

function getActionsHTML(position, action) {
	if (!action) return "";

	const title = !!t[`actions_${position}_title`] ? `<h4>${t[`actions_${position}_title`]}</h4>` : '';
	const text = !!t[`actions_${position}_text`] ? `<span>${t[`actions_${position}_text`]}</span>` : '';

	let textDiv = '';
	if (title || text) {
		textDiv = 	`<div style="text-align: left; margin: 0.5rem 0">
						${title}
						${text}
					</div>`;
	}

	let button = '';
	if (t[`actions_${position}_button_caption`] && t[`actions_${position}_button_link`]) {
		let btnClass = action.includes('text-dark') ? 'btn-outline-dark' : 'btn-outline-light';
		button = `<div style="margin: 0.5rem 0">
			<button id="actions-${position}-button" class="btn btn-lg ${btnClass}" onClick="window.open('${t[`actions_${position}_button_link`]}', '_blank')">
				${t[`actions_${position}_button_caption`]}
			</button>
		</div>`;
	}

	const actionDiv = `<div id="actions-${position}" class="${action}" style="border-radius: .25rem; display: flex; flex-wrap: wrap; justify-content: space-evenly; align-items: center; padding: 1rem 0; margin: 1rem 0 1.5rem">
							${textDiv}
							${button}
						</div>`

	return actionDiv;
}

function showQA() {
	$('#QAModal').modal('show');
}

function recreatePagination() {
	$('#pagination').empty();
	for (let i = 0; i < Object.keys(config.theses).length; i++) {
		$('#pagination').append('<li class="page-item"><button class="page-link' + getPaginationClasses(i) + '" onclick="loadThesisNumber(' + i + ')">' + (i + 1) + '</button></li>')
	}
}

function updateProgressBar() {
	let percentage = Math.round(100 * (currentThesis + 1) / Object.keys(config.theses).length);
	$('#overall-progress-bar').css('width', "" + percentage + "%");
}

function getPaginationClasses(i) {
	switch (answers[i]) {
		case "a":
		case "e":
			return " bg-success text-light";
			break;
		case "b":
		case "f":
			return " bg-warning text-dark";
			break;
		case "c":
		case "g":
			return " bg-danger text-light";
			break;
		case "d":
		case "h":
			return "";
			break;
		default:
			return "";
	}
}

function doYes() {
	if (isThesisMarkedImportant()) {
		answers[currentThesis] = 'e';
	} else {
		answers[currentThesis] = 'a';
	}
	recreatePagination();
	nextThesisAfterSelection();
}
function doNeutral() {
	if (isThesisMarkedImportant()) {
		answers[currentThesis] = 'f';
	} else {
		answers[currentThesis] = 'b';
	}
	recreatePagination();
	nextThesisAfterSelection();
}
function doNo() {
	if (isThesisMarkedImportant()) {
		answers[currentThesis] = 'g';
	} else {
		answers[currentThesis] = 'c';
	}
	recreatePagination();
	nextThesisAfterSelection();
}
function doSkip() {
	if (isThesisMarkedImportant()) {
		answers[currentThesis] = 'h';
	} else {
		answers[currentThesis] = 'd';
	}
	recreatePagination();
	nextThesisAfterSelection();
}

function toggleImportant() {
	answers[currentThesis] = toggleImportantCharacter(answers[currentThesis]);
	if (isThesisMarkedImportant()) {
		setImportant();
	} else {
		unsetImportant();
	}
}

function unsetImportant() {
	$('#btn-important').addClass('btn-light');
	$('#btn-important').removeClass('btn-info');
	$('#btn-important').text(t.btn_make_thesis_double_weight);
}

function setImportant() {
	$('#btn-important').removeClass('btn-light');
	$('#btn-important').addClass('btn-info');
	$('#btn-important').text(t.btn_thesis_has_double_weight);
}

function isThesisMarkedImportant() {
	return answers[currentThesis] === 'e' ||
		answers[currentThesis] === 'f' ||
		answers[currentThesis] === 'g' ||
		answers[currentThesis] === 'h';
}

function toggleImportantCharacter(char) {
	switch (char) {
		case 'a':
			return 'e';
			break;
		case 'b':
			return 'f';
			break;
		case 'c':
			return 'g';
			break;
		case 'd':
			return 'h';
			break;
		case 'e':
			return 'a';
			break;
		case 'f':
			return 'b';
			break;
		case 'g':
			return 'c';
			break;
		case 'h':
			return 'd';
			break;
		default:
			return 'd';
	}
}

function styleAnswerButtons() {
	$('#btn-yes').removeClass('btn-success');
	$('#btn-no').removeClass('btn-danger');
	$('#btn-neutral').removeClass('btn-warning');
	$('#btn-skip').removeClass('btn-secondary');
	unsetImportant();

	switch (answers[currentThesis]) {
		case "e":
			setImportant();
		case "a":
			$('#btn-yes').addClass('btn-success');
			break;

		case "f":
			setImportant();
		case "b":
			$('#btn-neutral').addClass('btn-warning');
			break;

		case "g":
			setImportant();
		case "c":
			$('#btn-no').addClass('btn-danger');
			break;

		case "h":
			setImportant();
		case "d":
			$('#btn-yes').addClass('btn-success');
			$('#btn-neutral').addClass('btn-warning');
			$('#btn-no').addClass('btn-danger');
			$('#btn-skip').addClass('btn-secondary');
			break;
	}
}

function initAnswers() {
	answers = [];
	for (let i = 0; i < Object.keys(config.theses).length; i++) {
		answers.push('d');
	}
}

function loadThesisNumber(number) {
	currentThesis = number;
	loadThesis();
}

function loadThesis() {
	if (currentThesis < 0) { currentThesis = 0; }
	if (currentThesis >= Object.keys(config.theses).length) { currentThesis = Object.keys(config.theses).length - 1; }

	let thesis_id = "" + currentThesis;
	$('#btn-toggle-thesis-more').fadeOut(200);
	$('#thesis-text').fadeOut(200, function () {
		$('#thesis-text').text(config.theses[thesis_id].l);
		$('#thesis-text').fadeIn(200);
		if (config.theses[thesis_id].x !== "") {
			$('#btn-toggle-thesis-more').fadeIn(200);
		}
	});
	$('#thesis-number').text(t.thesis_number(currentThesis + 1));
	//			$('#thesis-text').text(config.theses[thesis_id].l);
	$('#thesis-more').hide();
	$('#thesis-more').text(config.theses[thesis_id].x);

	styleAnswerButtons();
	updateProgressBar();
}

function nextThesisAfterSelection() {
	styleAnswerButtons();
	clearTimeout(timeout);
	timeout = setTimeout(function () {
		nextThesis();
	}, 300);
}

function nextThesis() {
	currentThesis++;
	if (currentThesis == Object.keys(config.theses).length) {
		showResults();
	} else {
		loadThesis();
	}
}

function prevThesis() {
	currentThesis--;
	loadThesis();
}

function showResults() {
	let maxAchievablePoints = 0;
	let results = [];
	for (let i = 0; i < answers.length; i++) {
		maxAchievablePoints += calculatePairPoints(answers[i], answers[i]);
	}
	for (list_id in config.lists) {
		let pointsForList = 0;
		for (let i = 0; i < answers.length; i++) {
			let thesis_id = "" + i;
			pointsForList += calculatePairPoints(answers[i], config.answers[list_id][thesis_id].selection);
		}
		let list = config.lists[list_id].name;
		let list_abbr = config.lists[list_id].name_x;
		results.push([list, list_abbr, pointsForList]);
	}
	results.sort(function (a, b) {return b[2] - a[2];});
	$('#result-summary').empty();
	for (let i=0; i < results.length; i++) {
		let result = results[i];
		let list = result[0];
		let list_abbr = result[1];
		let pointsForList = result[2];
		addResultSummary(list, list_abbr, pointsForList, maxAchievablePoints);
	}
	updateResultDetailPlaceholders();
	showResult();
}

function updateResultDetailPlaceholders() {
	for (let i = 0; i < answers.length; i++) {
		if (answers[i] === "e" || answers[i] === "f" || answers[i] === "g" || answers[i] === "h")
			$('#placeholder-your-choice-' + i).parent().addClass('bg-info');
		$('#placeholder-your-choice-' + i).replaceWith(getSelectionMarker(t.label_your_choice, answers[i]));
	}
}

function addResultSummary(list, list_abbr, pointsForList, maxAchievablePoints) {
	let percentage = Math.round(pointsForList / maxAchievablePoints * 100);
	let remaining_percentage = 100 - percentage;
	let text_percentage = t.achieved_points_text(pointsForList, maxAchievablePoints);
	let text_remaining_percentage = '';
	if (percentage < 20) {
		text_remaining_percentage = text_percentage;
		text_percentage = '';
	}

	$('#result-summary').append(getSummaryProgressBar(list, list_abbr, percentage, remaining_percentage, text_percentage, text_remaining_percentage));
}

function getSummaryProgressBar(list, list_abbr, percentage, remaining_percentage, text_percentage, text_remaining_percentage) {
	let bar = `<div class="row result-summary-row">\
				<div class="col-12 col-md-6">${list}${list !== list_abbr ? `<em> (${list_abbr})</em>` : ''}</div>\
				<div class="col-12 col-md-6">\
					<div class="progress" style="height: 2rem;">`;
	if (percentage > 0) {
		bar += '<div class="progress-bar main-progress-bar" role="progressbar" style="width: ' + percentage +
			'%" aria-valuenow="' + percentage + '" aria-valuemin="0" aria-valuemax="100"> ' + text_percentage + '</div>';
	}
	if (remaining_percentage > 0) {
		bar += '<div class="progress-bar remaining-progress-bar text-dark" role="progressbar" style="width: ' + remaining_percentage +
			'%" aria-valuenow="' + remaining_percentage + '" aria-valuemin="0" aria-valuemax="100"> ' + text_remaining_percentage + '</div>\
					</div>';
	}
	bar += '</div>\
				</div>\
			</div>';
	return bar;
}

function calculatePairPoints(self, list) {
	let str = self + list;
	switch (str) {
		case "aa":
		case "bb":
		case "cc":
			return 2;
			break;
		case "ab":
		case "ba":
		case "bc":
		case "cb":
			return 1;
			break;
		case "ea":
		case "fb":
		case "gc":
		case "ee":
		case "ff":
		case "gg":
			return 4;
			break;
		case "eb":
		case "fa":
		case "fc":
		case "gb":
		case "ef":
		case "fe":
		case "fg":
		case "gf":
			return 2;
			break;
		default:
			return 0;
	}
}

function setResultDetailCallbacks() {
	$('.result-detail-header').click(function () {
		$(this).next('.result-details').slideToggle();
	});
	$('.result-detail-footer').click(function () {
		$(this).prev('.result-details').slideToggle();
	});
}

function toggleThesisMore() {
	$('#thesis-more').slideToggle();
}

function initResultDetails() {
	$('#result-detail').empty();
	for (thesis_id in config.theses) {
		let thesisNumber = parseInt(thesis_id) + 1;
		let text = '<div class="card result-detail-card">\
				<div class="card-header result-detail-header">\
					'+ config.theses[thesis_id].s + '\
					<small>'+ t.thesis_number(thesisNumber) + '</small>\
					<span class="float-right"><i class="far fa-hand-point-up"></i></span>\
				</div>\
				<div class="result-details">\
					<div class="card-body">\
						<p class="card-text lead">'+ config.theses[thesis_id].l + '</p>\
					</div>\
					<ul class="list-group list-group-flush">';
		for (list_id in config.lists) {
			text += '<li class="list-group-item">\
							'+ getSelectionMarker(config.lists[list_id].name, config.answers[list_id][thesis_id].selection) + '\
							'+ statementOrDefault(config.answers[list_id][thesis_id].statement) + '</li>';
		}
		text += '</ul>\
				</div>\
				<div class="card-footer result-detail-footer">\
					<span class="badge badge-secondary" id="placeholder-your-choice-'+ thesis_id + '">PLACEHOLDER</span> | ';
		for (list_id in config.lists) {
			text += getSelectionMarker(config.lists[list_id].name_x, config.answers[list_id][thesis_id].selection);
		}
		text += '</div>\
				</div>'
		$('#result-detail').append(text);
	}
	setResultDetailCallbacks();
	$('.result-details').toggle();
}

function statementOrDefault(statement) {
	if (statement === "") {
		return t.default_text_no_statement;
	} else {
		return statement;
	}
}

function getSelectionMarker(list, selection) {
	if (selection === "a" || selection === "e") {
		return '<span class="badge badge-success">\
								<i class="fas fa-check"></i> '+ list + '</span> ';
	}
	if (selection === "b" || selection === "f") {
		return '<span class="badge badge-warning">\
								<i class="far fa-circle"></i> '+ list + '</span> ';
	}
	if (selection === "c" || selection === "g") {
		return '<span class="badge badge-danger">\
								<i class="fas fa-ban"></i> '+ list + '</span> ';
	}
	if (selection === "d" || selection === "h") {
		return '<span class="badge badge-secondary">\
								<i class="fas fa-minus"></i> '+ list + '</span> ';
	}
	return 'ERROR';
}

function showStart() {
	init();
	$("#vote-o-mat,#result").hide();
	$("#start").show();
	initializeHitsOnRestart();
}

function showVoteOMatFirstThesis() {
	currentThesis = 0;
	showVoteOMat();
}
function showVoteOMat() {
	loadThesis();
	initResultDetails();
	$("#start,#result").hide();
	$("#vote-o-mat").fadeIn();
	if (showSwypeInfo) {
		showSwypeInfo = false;
		$("#swype-info").show();
	}
	hit('start');
}

function showResult() {
	$("#start,#vote-o-mat").hide();
	$("#result").fadeIn();
	animateBars();
	hit('result');
}

function animateBars() {
	$('#result-summary .main-progress-bar').each(function (index) {
		var self = $(this);
		var width = self.css('width');
		var transition = self.css("transition");
		self.css("transition", "none");
		self.css('width', 0);
		setTimeout(function () {
			self.css("transition", transition);
			self.css('width', width);
		}, 200 + (index * 200));
	});
}

function hideSwypeInfo() {
	$("#swype-info").hide();
}