const { remote } = require('electron');
const settings = require('electron-settings');
const { app, Menu, MenuItem } = remote;

window.$ = window.jQuery = require('jquery');
require('popper.js');
require('bootstrap');
require('flipclock');
require('datejs');
require('spectrum-colorpicker');

var dayDigits = 0;

let clockOptions = {
    clockFace: 'DailyCounter',
    clockFaceOptions: {
        countdown: true,
        showSeconds: true,
        defaultLanguage: 'zh-cn',
        language: 'zh-cn',
    }
}

function setupCountdown(initClock) {
    var now = new Date()
    var examStart = Date.parse('June 7, 9:00')
    var examEnd = Date.parse('June 8, 17:00')

    var examInProgress = false;
    if (examStart.getTime() < now.getTime()) {
        // Exam in progress...
        if (now.getTime() < examEnd.getTime()) {
            examInProgress = true;
        } else {
            examStart.setFullYear(now.getFullYear() + 1)
        }
    }

    $('#countdownYear').text((i, oldtext) => {
        return examStart.getFullYear();
    })

    if (examInProgress) {
        if (initClock) {
            var clock = $('#countdownClock').FlipClock(0, clockOptions);
            clock.stop();
        }

        let timeTillEnd = examEnd.getTime() - now.getTime();
        window.setTimeout(() => { setupCountdown(true); }, timeTillEnd);
        return;
    }
    var countdownSeconds = (examStart.getTime() - now.getTime()) / 1000;

    if (initClock) {
        var clock = $('#countdownClock').FlipClock(countdownSeconds, clockOptions);
        clock.face.once('stop', () => {
            setupCountdown(false);
        });
        clock.face.on('flip', () => {
            fixLabelPosition();
        });
    }
}

function setupBackground() {
    setBackgroundMask(settings.get('app-background-color'));
    $('#countdownBackground').css('background-image', (i, src) => {
        return `url("${loadBackground()}")`;
    });
}

function setBackgroundMask(color) {
    let styleSheet = getStyleSheet('app_styles');
    for (var i = 0; i < styleSheet.cssRules.length; i++) {
        let rule = styleSheet.cssRules[i];
        if (rule.selectorText == '.background::before') {
            rule.style['background-color'] = color;
            break;
        }
    }
}

function getStyleSheet(unique_title) {
    for (var i = 0; i < document.styleSheets.length; i++) {
        var sheet = document.styleSheets[i];
        if (sheet.title == unique_title) {
            return sheet;
        }
    }
}

function loadBackground() {
    var bg = settings.get('app-background');
    if (!bg) return './def_bg.jpg';
    return bg;
}

function applyBackground(file) {
    var reader = new FileReader();
    reader.onload = () => {
        settings.set('app-background', reader.result);
        setupBackground();
    };
    reader.readAsDataURL(file);
}

function resetBackground() {
    settings.delete('app-background');

    setupBackground();
}

function toggleFrameless() {
    settings.set('frameless', !(settings.get('frameless') == true));

    remote.getGlobal('recreateWindow')();
}

function dropImage(ev) {
    if (ev.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        for (var i = 0; i < ev.dataTransfer.items.length; i++) {
            // If dropped items aren't files, reject them
            if (ev.dataTransfer.items[i].kind === 'file') {
                var file = ev.dataTransfer.items[i].getAsFile();
                applyBackground(file);
                return;
            }
        }
    } else {
        // Use DataTransfer interface to access the file(s)
        for (var i = 0; i < ev.dataTransfer.files.length; i++) {
            applyBackground(ev.dataTransfer.files[i]);
            return;
        }
    }

    // Pass event to removeDragData for cleanup
    removeDragData(ev);
}

function removeDragData(ev) {

    if (ev.dataTransfer.items) {
        // Use DataTransferItemList interface to remove the drag data
        ev.dataTransfer.items.clear();
    } else {
        // Use DataTransfer interface to remove the drag data
        ev.dataTransfer.clearData();
    }
}

function setupContextMenu() {
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        let frameless = settings.get('frameless') == true;

        const menu = new Menu();
        menu.append(new MenuItem({ label: `高考倒计时`, enabled: false }));
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({ label: '还原背景', click: resetBackground }));
        menu.append(new MenuItem({ label: '设置背景遮罩', click: changeBackgroundMask }));
        menu.append(new MenuItem({ type: 'checkbox', label: '无边框', checked: frameless, click: toggleFrameless }));
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({ label: '退出', click: function () { app.exit(0); } }));
        menu.popup({ window: remote.getCurrentWindow() });
    }, false);
}

function updateContentScale() {
    let width = document.body.offsetWidth;
    if (width > 800) {
        $('.countdown-container').css('transform', 'scale(1)');
    } else {
        $('.countdown-container').css('transform', `scale(${width / 800})`);
    }
}

function fixLabelPosition() {
    let dayDivider = $($('.flipclock-wrapper').children()[0]);
    let dayDigits = dayDivider.nextUntil('.flipclock-divider').length;

    if (dayDigits == this.dayDigits) return;

    let dayLabel = $('.flipclock-label', dayDivider);
    if (dayDigits == 3) {
        dayLabel.css('right', '-120px');
    } else {
        dayLabel.css('right', '-86px');
    }
    dayLabel.text('天')
    this.dayDigits = dayDigits;
}

function changeBackgroundMask() {
    $("#maskColorPicker").spectrum({
        color: settings.get('app-background-color'),
        flat: true,
        showInput: false,
        showAlpha: true,
        showButtons: false,
        preferredFormat: 'rgb'
    });
    $('#maskColorPickerModal').modal();
}

$(document).ready(function () {
    setupBackground();
    setupCountdown(true);
    setupContextMenu();
    updateContentScale();

    fixLabelPosition();

    // Restart every midnight to prevent from memory leaks and inaccurates
    var interval = Date.today().add(1).days().getTime() - Date.now();
    window.setInterval(() => { setupCountdown(true); }, interval);
    window.onresize = (ev) => { updateContentScale(); };
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();

    dropImage(e);
});
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

$('#maskColorPickerSave').on('click', (ev) => {
    let backgroundColor = $("#maskColorPicker").spectrum('get').toRgbString();
    settings.set('app-background-color', backgroundColor);
    $('#maskColorPickerModal').modal('hide');

    setBackgroundMask(backgroundColor);
});