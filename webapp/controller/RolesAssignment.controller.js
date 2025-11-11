sap.ui.define([
    "com/my/users/controller/BaseController", // <-- Asegúrate de que este archivo exista y tenga getRouter()
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (BaseController, JSONModel, MessageBox, MessageToast) {
    "use strict";

    return BaseController.extend("com.my.users.controller.RolesAssignment", {

        onInit: function () {
            const oRolesModel = new JSONModel({ value: [] });
            this.getView().setModel(oRolesModel, "roles");

            const oViewModel = new JSONModel({
                userId: "",
                busy: false
            });
            this.getView().setModel(oViewModel, "view");

            // Asumimos que getRouter() viene de BaseController
            this.getRouter().getRoute("assignRoles").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            const sUserId = oEvent.getParameter("arguments").userId;
            const oViewModel = this.getView().getModel("view");
            
            oViewModel.setProperty("/userId", sUserId);
            oViewModel.setProperty("/busy", true);

            this.byId("rolesTable").removeSelections(true);
            this._loadAllRoles();
        },

        _loadAllRoles: async function () {
            const oRolesModel = this.getView().getModel("roles");
            const oViewModel = this.getView().getModel("view");
            
            const sUrl = "http://localhost:3333/api/roles/crud?ProcessType=getAll&DBServer=MongoDB&LoggedUser=FRONTEND";

            try {
                const response = await fetch(sUrl, {
                    method: "POST", 
                    headers: { "Content-Type": "application/json" }
                });

                if (!response.ok) {
                    throw new Error("Error HTTP: " + response.status);
                }

                const data = await response.json();
                const aRoles = data?.value?.[0]?.data?.[0]?.dataRes || [];

                if (aRoles.length > 0) {
                    oRolesModel.setData({ value: aRoles }); 
                } else {
                    MessageToast.show("No se encontraron roles disponibles.");
                    oRolesModel.setData({ value: [] }); 
                }

            } catch (error) {
                console.error("Error al obtener roles:", error);
                MessageBox.error("No se pudieron cargar los roles. Error de conexión o API.");
            } finally {
                oViewModel.setProperty("/busy", false);
            }
        },
        
        onAssignRolesPress: function () {
            const oTable = this.byId("rolesTable");
            const aSelectedItems = oTable.getSelectedItems(); 
            
            if (aSelectedItems.length === 0) {
                MessageToast.show("Por favor, seleccione al menos un rol para asignar.");
                return;
            }

            const oViewModel = this.getView().getModel("view");
            const sUserId = oViewModel.getProperty("/userId");

            const aRoleIds = aSelectedItems.map(item => {
                return item.getBindingContext("roles").getProperty("ROLEID");
            });

            MessageBox.confirm(`¿Desea asignar ${aRoleIds.length} rol(es) al usuario ${sUserId}?`, {
                title: "Confirmar Asignación",
                onClose: (oAction) => {
                    if (oAction === MessageBox.Action.OK) {
                        this._executeAssignment(sUserId, aRoleIds);
                    }
                }
            });
        },

        _executeAssignment: async function (sUserId, aRoleIds) {
            const oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/busy", true);

            const sUrl = `http://localhost:3333/api/users/crud?ProcessType=assignRol&DBServer=MongoDB&LoggedUser=AGUIZARE`;
            
            let iSuccessCount = 0;
            let aErrors = [];

            const aPromises = aRoleIds.map(sRoleId => {
                const requestBody = {
                    usuario: {
                        USERID: sUserId,
                        ROLEID: sRoleId 
                    }
                };
                
                return fetch(sUrl, {
                    method: "POST", 
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                }).then(response => response.json())
                  .then(data => {
                      if (data.value[0].success) {
                          iSuccessCount++;
                      } else {
                          aErrors.push(sRoleId);
                      }
                  });
            });

            try {
                await Promise.all(aPromises);
                oViewModel.setProperty("/busy", false);

                if (aErrors.length > 0) {
                    MessageBox.error(`Se asignaron ${iSuccessCount} roles. Fallaron: ${aErrors.join(", ")}`);
                } else {
                    MessageBox.success(`¡Éxito! Se asignaron ${iSuccessCount} rol(es).`, {
                        onClose: () => {
                            // Regresamos al perfil del usuario
                            this.onNavBack();
                        }
                    });
                }
            } catch (error) {
                oViewModel.setProperty("/busy", false);
                MessageBox.error("Error de red al asignar roles: " + error.message);
            }
        },

        // Esta función es CORRECTA para solucionar la caché
        onNavBack: function () {
            const sUserId = this.getView().getModel("view").getProperty("/userId");
            
            // Asumimos que getRouter() viene de BaseController
            this.getRouter().navTo("profile", {
                userId: sUserId
            }, true /* bReplace: true (reemplaza la página en el historial) */); 
        }
    });
});