sap.ui.define([
    // Asegúrate de que esta ruta sea correcta para tu proyecto
    "com/my/users/controller/BaseController", 
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",   // <-- AÑADIDO
    "sap/m/MessageBox"    // <-- AÑADIDO
], function (BaseController, JSONModel, MessageToast, MessageBox) { // <-- AÑADIDOS
    "use strict";

    return BaseController.extend("com.my.users.controller.Profile", {

        onInit: function () {
            // Tu lógica de Init (esto está perfecto)
            const oProfileModel = new JSONModel({});
            this.getView().setModel(oProfileModel); 
            const oRouter = this.getRouter(); // Asume que getRouter() viene de BaseController
            oRouter.getRoute("profile").attachPatternMatched(this._onRouteMatched, this);
        },

        // Tu lógica de _onRouteMatched (esto está perfecto)
        _onRouteMatched: function (oEvent) {
            const sUserId = oEvent.getParameter("arguments").userId;
            if (sUserId) {
                this.getView().setBusy(true);
                this._loadProfileDataFromAPI(sUserId);
            }
        },

        // Tu lógica de _loadProfileDataFromAPI (esto está perfecto)
        _loadProfileDataFromAPI: function (sUserId) {
            // Limpia el modelo anterior para evitar mostrar datos viejos
            this.getView().getModel().setData({}); 
            
            const sUrl = "http://localhost:3333/api/users/crud?ProcessType=getById&DBServer=MongoDB&LoggedUser=AGUIZARE";
            const requestBody = { usuario: { USERID: sUserId } }; 

            fetch(sUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            })
            .then((response) => response.json())
            .then((data) => {
                this.getView().getModel().setData(data); // Carga la respuesta COMPLETA
                const oUserData = data?.value?.[0]?.data?.[0]?.dataRes;
                if (!oUserData || !oUserData.USERID) {
                    MessageBox.error("No se encontraron detalles para el usuario " + sUserId);
                    this.onNavBack(); 
                }
            })
            .catch((error) => {
                MessageBox.error("No se pudo conectar al servicio.");
                this.onNavBack(); 
            })
            .finally(() => {
                this.getView().setBusy(false);
            });
        },

        // Tu lógica de onNavBack (esto está perfecto)
        onNavBack: function () {
            const oHistory = sap.ui.core.routing.History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getRouter().navTo("users", {}, true); 
            }
        },

        // Tu lógica de onNavToAssignRoles (esto está perfecto)
        onNavToAssignRoles: function () {
            const sUserId = this.getView().getModel().getProperty("/value/0/data/0/dataRes/USERID");
            if (!sUserId) {
                MessageToast.show("Error: No se ha cargado el ID del usuario.");
                return;
            }
            this.getRouter().navTo("assignRoles", {
                userId: sUserId 
            });
        },
        
        onRoleTokenUpdate: function (oEvent) {
            // Solo nos interesa el evento "removed" (borrado)
            if (oEvent.getParameter("type") !== "removed") {
                return;
            }

            const oRemovedToken = oEvent.getParameter("removedTokens")[0];
            const sRoleID = oRemovedToken.getKey(); 
            const sUserID = this.getView().getModel().getProperty("/value/0/data/0/dataRes/USERID");

            if (!sUserID || !sRoleID) {
                MessageToast.show("Error: No se pudo obtener el ID de usuario o rol.");
                return;
            }

            // 1. CONFIRMACIÓN
            MessageBox.confirm(`¿Desea eliminar el rol '${sRoleID}' de este usuario?`, {
                title: "Confirmar Eliminación",
                onClose: (oAction) => {
                    if (oAction === MessageBox.Action.OK) {
                        // 2. LLAMAR A LA API (si el usuario dice OK)
                        this._executeUnassign(sUserID, sRoleID);
                    } else {
                        // 3. ¡ARREGLO DEL BUG DE CANCELAR!
                        // Si el usuario cancela, el token ya se borró visualmente.
                        // Forzamos una recarga para resincronizar la vista.
                        MessageToast.show("Operación cancelada.");
                        this.getView().setBusy(true);
                        this._loadProfileDataFromAPI(sUserID); 
                    }
                }
            });
        },

        _executeUnassign: function (sUserID, sRoleID) {
            const sUrl = "http://localhost:3333/api/users/crud?ProcessType=unassignRol&DBServer=MongoDB&LoggedUser=AGUIZARE";
            const requestBody = {
                usuario: { USERID: sUserID, ROLEID: sRoleID }
            };

            this.getView().setBusy(true);

            fetch(sUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            })
            .then(response => response.json())
            .then(data => {
                if (data && data.value && data.value[0] && data.value[0].success) {
                    MessageToast.show(`Rol ${sRoleID} desasignado.`);
                    // Forzamos la recarga DESPUÉS de un borrado exitoso
                    this._loadProfileDataFromAPI(sUserID);
                } else {
                    throw new Error(data.value[0].messageUSR || "Error al desasignar el rol.");
                }
            })
            .catch(error => {
                MessageBox.error(error.message);
                // Si la API falla, también recargamos para revertir el cambio visual
                this._loadProfileDataFromAPI(sUserID); 
            })
            .finally(() => {
                // setBusy(false) se maneja dentro del _loadProfileDataFromAPI
            });
        }
    });
});