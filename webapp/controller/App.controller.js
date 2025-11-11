sap.ui.define([
	"./BaseController",
	"sap/ui/core/UIComponent",
	"sap/m/SplitApp" // Añadido para asegurar la referencia al control
], function (BaseController, UIComponent, SplitApp) {
	"use strict";

	return BaseController.extend("com.my.users.controller.App", {
		
		onInit: function () {
			// Aplica la clase de densidad según el dispositivo
			this.getView().addStyleClass(
				this.getOwnerComponent().getContentDensityClass()
			);
			
			// Inicializar el router (Necesario para usar navTo)
			this.oRouter = this.getOwnerComponent().getRouter();
		},

		/**
		 * Evento del botón de menú lateral
		 */
		onMenuButtonPress: function () {
			// USAR EL ID CORRECTO: "app" según App.view.xml
			var oSplitApp = this.byId("app");
			
			if (oSplitApp) {
				// Utilizar el método toogleMasterSide para simplificar
				oSplitApp.toogleMasterSide();
			} else {
				console.error("SplitApp con ID 'app' no encontrado.");
			}
		},

		/**
		 * Evento al seleccionar un item del menú lateral
		 */
		onSideNavSelection: function (oEvent) {
			var oItem = oEvent.getParameter("listItem");
			// Obtener la clave de navegación (users, roles, apps, process)
			var sKey = oItem.getCustomData()[0].getValue();
            
			if (sKey) {
				// *** NAVEGACIÓN CORREGIDA: USAR EL ROUTER ***
				// Esto coincide con las rutas definidas en tu manifest.json
				this.oRouter.navTo(sKey);

				// Cerrar menú lateral si estamos en modo Popover (útil en móvil)
				var oSplitApp = this.byId("app");
				if (oSplitApp && oSplitApp.getMode() === "PopoverMode") {
					oSplitApp.hideMaster();
				}
			} else {
				// Solo si el item no tiene CustomData, lo cual no debería pasar
				console.warn("Elemento de navegación sin clave definida.");
			}
		}
	});
});
