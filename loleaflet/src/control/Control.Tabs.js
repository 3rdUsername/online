/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.Tabs is used to switch sheets in Calc
 */

/* global $ vex _ _UNO */
L.Control.Tabs = L.Control.extend({
	onAdd: function(map) {
		map.on('updatepermission', this._onUpdatePermission, this);
		this._initialized = false;
	},

	_onUpdatePermission: function(e) {
		if (this._map.getDocType() !== 'spreadsheet') {
			return;
		}

		if (!this._initialized) {
			this._initialize();
		}
		setTimeout(function() {
			$('.spreadsheet-tab').contextMenu(e.perm === 'edit');
		}, 100);

		if (window.mode.isMobile() == true) {
			if (e.perm === 'edit') {
				$('.spreadsheet-tabs-container').css('bottom', '33px');
				$('#spreadsheet-toolbar').css('bottom', '33px');
			}
			else {
				$('.spreadsheet-tabs-container').css('bottom', '0px');
				$('#spreadsheet-toolbar').css('bottom', '0px');
			}
		}
	},

	_initialize: function () {
		this._initialized = true;
		this._tabsInitialized = false;
		this._spreadsheetTabs = {};
		this._tabForContextMenu = 0;
		var map = this._map;
		var docContainer = map.options.documentContainer;
		this._tabsCont = L.DomUtil.create('div', 'spreadsheet-tabs-container', docContainer.parentElement);

		this._menuItem = {
			'insertsheetbefore': {name: _('Insert sheet before this'),
				callback: (this._insertSheetBefore).bind(this)
			},
			'insertsheetafter': {name: _('Insert sheet after this'),
				callback: (this._insertSheetAfter).bind(this)
			},
			'deletesheet': {name: _UNO('.uno:Remove', 'spreadsheet', true),
				callback: (this._deleteSheet).bind(this)
			},
			'renamesheet': {name: _UNO('.uno:RenameTable', 'spreadsheet', true),
				callback: (this._renameSheet).bind(this)
			} ,
			'showsheets': {
				name: _UNO('.uno:Show', 'spreadsheet', true),
				callback: (this._showSheet).bind(this),
			},
			'hiddensheets': {
				name: _UNO('.uno:Hide', 'spreadsheet', true),
				callback: (this._hideSheet).bind(this)
			}
		};

		if (!window.mode.isMobile()) {
			L.installContextMenu({
				selector: '.spreadsheet-tab',
				className: 'loleaflet-font',
				items: this._menuItem,
				zIndex: 1000
			});
		}

		map.on('updateparts', this._updateDisabled, this);
	},

	_updateDisabled: function (e) {
		var parts = e.parts;
		var selectedPart = e.selectedPart;
		var docType = e.docType;

		if (docType === 'text') {
			return;
		}
		if (docType === 'spreadsheet') {
			if (!this._tabsInitialized) {
				// make room for the preview
				var docContainer = this._map.options.documentContainer;
				L.DomUtil.addClass(docContainer, 'spreadsheet-document');
				setTimeout(L.bind(function () {
					this._map.invalidateSize();
					$('.scroll-container').mCustomScrollbar('update');
					$('.scroll-container').mCustomScrollbar('scrollTo', [0, 0]);
				}, this), 100);
				this._tabsInitialized = true;
			}
			if ('partNames' in e) {
				while (this._tabsCont.firstChild) {
					this._tabsCont.removeChild(this._tabsCont.firstChild);
				}
				var ssTabScroll = L.DomUtil.create('div', 'spreadsheet-tab-scroll', this._tabsCont);
				ssTabScroll.id = 'spreadsheet-tab-scroll';

				if (window.mode.isMobile()) {
					var menuData = L.Control.JSDialogBuilder.getMenuStructureForMobileWizard(this._menuItem, true, '');
				}

				for (var i = 0; i < parts; i++) {
					if (e.hiddenParts.indexOf(i) !== -1)
						continue;
					var id = 'spreadsheet-tab' + i;
					var tab = L.DomUtil.create('button', 'spreadsheet-tab', ssTabScroll);
					L.DomEvent.enableLongTap(tab);

					L.DomEvent.on(tab, 'contextmenu', function(j) {
						return function() {
							this._tabForContextMenu = j;
							if (window.mode.isMobile()) {
								window.contextMenuWizard = true;
								if (this._map._permission != 'readonly') this._map.fire('mobilewizard', menuData);
							} else {
								$('spreadsheet-tab' + j).contextMenu();
							}
						};
					}(i).bind(this));

					tab.textContent = e.partNames[i];
					tab.id = id;

					L.DomEvent
						.on(tab, 'click', L.DomEvent.stopPropagation)
						.on(tab, 'click', L.DomEvent.stop)
						.on(tab, 'click', this._setPart, this)
						.on(tab, 'click', this._map.focus, this._map);
					this._spreadsheetTabs[id] = tab;
				}
			}
			for (var key in this._spreadsheetTabs) {
				var part =  parseInt(key.match(/\d+/g)[0]);
				L.DomUtil.removeClass(this._spreadsheetTabs[key], 'spreadsheet-tab-selected');
				if (part === selectedPart) {
					L.DomUtil.addClass(this._spreadsheetTabs[key], 'spreadsheet-tab-selected');
				}
			}
		}
	},

	_setPart: function (e) {
		var part =  e.target.id.match(/\d+/g)[0];
		if (part !== null) {
			this._map._docLayer._clearReferences();
			this._map.setPart(parseInt(part), /*external:*/ false, /*calledFromSetPartHandler:*/ true);
		}
	},

	_insertSheetBefore: function() {
		this._map.insertPage(this._tabForContextMenu);
	},

	_insertSheetAfter: function() {
		this._map.insertPage(this._tabForContextMenu + 1);
	},

	_deleteSheet: function() {
		var map = this._map;
		var nPos = this._tabForContextMenu;
		vex.dialog.confirm({
			message: _('Are you sure you want to delete sheet, %sheet% ?').replace('%sheet%', $('#spreadsheet-tab' + this._tabForContextMenu).text()),
			callback: function(data) {
				if (data) {
					map.deletePage(nPos);
				}
			}
		});
	},

	_renameSheet: function() {
		var map = this._map;
		var nPos = this._tabForContextMenu;
		vex.dialog.open({
			message: _('Enter new sheet name'),
			input: '<input name="sheetname" type="text" value="' + $('#spreadsheet-tab' + this._tabForContextMenu).text() + '" required />',
			callback: function(data) {
				map.renamePage(data.sheetname, nPos);
			}
		});
	},

	_showSheet: function() {
		this._map.showPage();
	},

	_hideSheet: function() {
		this._map.hidePage();
	}
});

L.control.tabs = function (options) {
	return new L.Control.Tabs(options);
};
