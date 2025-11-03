sap.ui.define(
	[
		"./BaseController",
		"sap/ui/core/Fragment",
		"sap/m/MessageToast",
		"sap/ui/core/UIComponent",
	],
	function (BaseController, Fragment, MessageToast, UIComponent) {
		"use strict";

		return BaseController.extend("com.my.users.controller.App", {
			onInit: function () {
				// Aplica la clase de densidad según el dispositivo
				this.getView().addStyleClass(
					this.getOwnerComponent().getContentDensityClass()
				);
			},

			/**
			 * Evento del botón de menú lateral
			 */
			onMenuButtonPress: function () {
				var oSplitApp = this.byId("splitApp");
	
				if (oSplitApp.isMasterShown()) {
					oSplitApp.hideMaster();
				} else {
					oSplitApp.showMaster();
				}
			},

			/**
			 * Evento al seleccionar un item del menú lateral
			 */
			onSideNavSelection: function (oEvent) {
				var oItem = oEvent.getParameter("listItem");
				var sKey = oItem.getCustomData()[0].getValue();

				var oNavContainer = this.byId("navContainer");

				switch (sKey) {
					case "users":
						this._navToPage(
							oNavContainer,
							"com.my.users.view.Users",
							"Usuarios"
						);
						break;
					case "roles":
						this._navToPage(oNavContainer, "com.my.users.view.Roles", "Roles");
						break;
					case "application":
						this._navToPage(
							oNavContainer,
							"com.my.users.view.Application",
							"Aplicaciones"
						);
						break;
					case "process":
						this._navToPage(
							oNavContainer,
							"com.my.users.view.Process",
							"Procesos"
						);
						break;
					default:
						MessageToast.show("Opción no disponible");
				}

				// Cerrar menú lateral si estamos en modo Popover
				var oSplitApp = this.byId("splitApp");
				if (oSplitApp.getMode() === "PopoverMode") {
					oSplitApp.hideMaster();
				}
			},

			/**
			 * Función privada para navegar a una vista
			 */
			_navToPage: function (oNavContainer, sViewName, sTitle) {
				var oPage = oNavContainer.getPage(sViewName);

				if (!oPage) {
					oPage = sap.ui.xmlview({
						id: sViewName,
						viewName: sViewName,
					});
					oNavContainer.addPage(oPage);
				}

				oNavContainer.to(oPage);
			},
		});
	}
);
