sap.ui.define([
    "./BaseController",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment"
], function (BaseController, MessageBox, JSONModel, Filter, FilterOperator, Fragment) {
    "use strict";

    return BaseController.extend("com.my.users.controller.Application", {

        _oViewDialog: null, 

        onInit: function () {
            const oViewModel = new JSONModel({
                // Lista de aplicaciones que vendrán del backend (para el Select)
                applications: [],

                // Identificador de la aplicación elegida en el Select
                selectedAppId: null,

                // Guardamos toda la información recibida por cada aplicación (vistas + procesos)
                masterDataMap: {},

                // Datos que se muestran en las tablas según lo que seleccione el usuario
                views: [],
                processesMap: {},

                // Los privilegios aún son simulados localmente
                privilegesMap: {},

                // Datos filtrados según selección del usuario
                filteredProcesses: [],
                filteredPrivileges: [],

                // Elementos seleccionados en las tablas
                selectedView: null,
                selectedProcess: null,
                selectedPrivilege: null,

                // Estados de UI para mostrar loading o errores
                loading: false,
                loadError: null,

                // Datos del formulario para crear/editar vista
                viewFormData: {
                    isEdit: false,
                    VIEWSID: "",
                    Descripcion: ""
                },

                // Privilegios de prueba (simulados)
                mockPrivileges: {
                    "PROC001_UPDATED": [{ PRIVILEGIEID: "PR_UPD", Descripcion: "Actualizar" }],
                    "PROC004":         [{ PRIVILEGIEID: "PR_004", Descripcion: "Proceso 4" }],
                    "PROC_FINAL_01":   [{ PRIVILEGIEID: "PR_F01", Descripcion: "Proceso Final" }],
                    "PROC001":         [{ PRIVILEGIEID: "PR_001", Descripcion: "Proceso 1" }],
                    "PROC002":         [{ PRIVILEGIEID: "PR_002", Descripcion: "Proceso 2" }],
                }
            });

            this.getView().setModel(oViewModel, "viewModel");
            this.fetchAllData();
        },

        /**
         * Obtiene todas las aplicaciones desde la API.
         * Luego reorganiza la información en un formato más fácil de utilizar desde la UI.
         */
        fetchAllData: async function () {
            const oModel = this.getView().getModel("viewModel");
            const dbServer = "MongoDB"; 
            const apiRoute = `http://localhost:3333/api/application/crud?ProcessType=getAplications&dbserver=${dbServer}&LoggedUser=AGUIZARE`;

            oModel.setProperty("/loading", true);
            oModel.setProperty("/loadError", null);

            try {
                const res = await fetch(apiRoute, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                
                // Obtenemos la lista de aplicaciones del backend
                const aAllAppsData = data.data[0].dataRes || [];

                const aApplications = []; 
                const oMasterMap = {};    

                // Se cargan los privilegios simulados en el modelo
                oModel.setProperty("/privilegesMap", oModel.getProperty("/mockPrivileges"));

                // Recorremos todas las aplicaciones recibidas
                aAllAppsData.forEach(app => {
                    // Agregamos la app al selector
                    aApplications.push({
                        APPID: app.APPID,
                        NAME: app.NAME 
                    });

                    const aViews = [];
                    const oProcessesMap = {};
                    const aRawViews = app.VIEWS || [];

                    // Recorremos todas las vistas de la aplicación
                    aRawViews.forEach(view => {
                        aViews.push({
                            VIEWSID: view.VIEWSID,
                            Descripcion: view.VIEWSID  // Aún no recibimos descripciones desde backend
                        });

                        const aProcesses = [];
                        const aRawProcesses = view.PROCESS || [];

                        // Recorremos los procesos dentro de cada vista
                        aRawProcesses.forEach(proc => {
                            aProcesses.push({
                                PROCESSID: proc.PROCESSID,
                                Descripcion: proc.PROCESSID // Sin descripción aún
                            });
                        });
                        
                        oProcessesMap[view.VIEWSID] = aProcesses;
                    });

                    // Guardamos todo lo procesado para esta aplicación
                    oMasterMap[app.APPID] = {
                        views: aViews,
                        processesMap: oProcessesMap
                    };
                });

                // Finalmente, actualizamos el modelo
                oModel.setProperty("/applications", aApplications);
                oModel.setProperty("/masterDataMap", oMasterMap);

            } catch (err) {
                oModel.setProperty("/loadError", err.message || String(err));
                MessageBox.error("Error al cargar datos: " + err.message);
            } finally {
                oModel.setProperty("/loading", false);
            }
        },

        /**
         * Se ejecuta cuando el usuario escoge una aplicación del Select.
         * Actualiza las tablas y limpia selecciones previas.
         */
        onAppSelectionChange: function(oEvent) {
            const oModel = this.getView().getModel("viewModel");
            const sSelectedAppId = oEvent.getParameter("selectedItem").getKey();
            const oMasterMap = oModel.getProperty("/masterDataMap");

            const oAppData = oMasterMap[sSelectedAppId] || { views: [], processesMap: {} };

            oModel.setProperty("/views", oAppData.views);
            oModel.setProperty("/processesMap", oAppData.processesMap);

            // Limpiar todo lo seleccionado en tablas
            oModel.setProperty("/selectedView", null);
            oModel.setProperty("/selectedProcess", null);
            oModel.setProperty("/selectedPrivilege", null);
            oModel.setProperty("/filteredProcesses", []);
            oModel.setProperty("/filteredPrivileges", []);
            this.byId("viewsTable").clearSelection();
            this.byId("processesTable").clearSelection();
            this.byId("privilegesTable").clearSelection();
        },

        /**
         * Se ejecuta cuando el usuario selecciona una vista.
         * Carga los procesos correspondientes a esa vista.
         */
        onViewSelectionChange: function (oEvent) {
            const oModel = this.getView().getModel("viewModel");
            const oContext = oEvent.getParameter("rowContext");
            
            if (!oContext) { 
                // Vista deseleccionada → limpiamos todo lo relacionado
                oModel.setProperty("/selectedView", null);
                oModel.setProperty("/filteredProcesses", []);
                oModel.setProperty("/filteredPrivileges", []);
                oModel.setProperty("/selectedProcess", null);
                oModel.setProperty("/selectedPrivilege", null);
                this.byId("processesTable").clearSelection();
                this.byId("privilegesTable").clearSelection();
                return;
            }

            const oSelectedView = oContext.getObject();
            const sViewId = oSelectedView.VIEWSID;
            const oProcessesMap = oModel.getProperty("/processesMap");

            oModel.setProperty("/selectedView", oSelectedView);
            oModel.setProperty("/filteredProcesses", oProcessesMap[sViewId] || []);
            
            // Limpiar selección de procesos y privilegios
            oModel.setProperty("/filteredPrivileges", []);
            oModel.setProperty("/selectedProcess", null);
            oModel.setProperty("/selectedPrivilege", null);
            this.byId("processesTable").clearSelection();
            this.byId("privilegesTable").clearSelection();
        },

        /**
         * Cuando se selecciona un proceso, mostramos los privilegios asociados.
         */
        onProcessSelectionChange: function (oEvent) {
            const oModel = this.getView().getModel("viewModel");
            const oContext = oEvent.getParameter("rowContext");

            if (!oContext) {
                oModel.setProperty("/selectedProcess", null);
                oModel.setProperty("/filteredPrivileges", []);
                oModel.setProperty("/selectedPrivilege", null);
                this.byId("privilegesTable").clearSelection();
                return;
            }

            const oSelectedProcess = oContext.getObject();
            const sProcessId = oSelectedProcess.PROCESSID;
            const oPrivilegesMap = oModel.getProperty("/privilegesMap");

            oModel.setProperty("/selectedProcess", oSelectedProcess);
            oModel.setProperty("/filteredPrivileges", oPrivilegesMap[sProcessId] || []);
            oModel.setProperty("/selectedPrivilege", null);
            this.byId("privilegesTable").clearSelection();
        },

        onPrivilegeSelectionChange: function (oEvent) {
            const oModel = this.getView().getModel("viewModel");
            const oContext = oEvent.getParameter("rowContext");
            oModel.setProperty("/selectedPrivilege", oContext ? oContext.getObject() : null);
        },

        /** -------------------- Búsquedas -------------------- */

        onSearchViews: function (oEvent) {
            const sQuery = oEvent.getParameter("query").toLowerCase();
            const aFilters = [];
            if (sQuery) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("VIEWSID", FilterOperator.Contains, sQuery),
                        new Filter("Descripcion", FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }
            this.byId("viewsTable").getBinding("rows").filter(aFilters);
        },

        onSearchProcesses: function (oEvent) {
            const sQuery = oEvent.getParameter("query").toLowerCase();
            const aFilters = [];
            if (sQuery) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("PROCESSID", FilterOperator.Contains, sQuery),
                        new Filter("Descripcion", FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }
            this.byId("processesTable").getBinding("rows").filter(aFilters);
        },

        onSearchPrivileges: function (oEvent) {
            const sQuery = oEvent.getParameter("query").toLowerCase();
            const aFilters = [];
            if (sQuery) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("PRIVILEGIEID", FilterOperator.Contains, sQuery),
                        new Filter("Descripcion", FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }
            this.byId("privilegesTable").getBinding("rows").filter(aFilters);
        },

        /** -------------------- Diálogo para crear/editar vistas -------------------- */

        _getDialog: function () {
            if (!this._oViewDialog) {
                this._oViewDialog = this.loadFragment({
                    id: this.getView().getId(),
                    name: "com.my.users.fragment.ViewDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getView().addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            }
            return this._oViewDialog;
        },

        onCreateView: function () {
            this.getView().getModel("viewModel").setProperty("/viewFormData", {
                isEdit: false,
                VIEWSID: "",
                Descripcion: ""
            });
            
            this._getDialog().then(function (oDialog) {
                oDialog.setTitle("Crear Nueva Vista");
                oDialog.open();
            });
        },

        onEditView: function () {
            const oSelectedView = this.getView().getModel("viewModel").getProperty("/selectedView");
            if (!oSelectedView) {
                MessageBox.warning("Por favor, seleccione una vista para editar.");
                return;
            }
            
            this.getView().getModel("viewModel").setProperty("/viewFormData", {
                isEdit: true,
                ...oSelectedView 
            });
            
            this._getDialog().then(function (oDialog) {
                oDialog.setTitle("Editar Vista");
                oDialog.open();
            });
        },

        onCloseDialog: function () {
            this._getDialog().then(oDialog => oDialog.close());
        },

        onSaveView: function () {
            const oModel = this.getView().getModel("viewModel");
            const oFormData = oModel.getProperty("/viewFormData");

            const sAppId = oModel.getProperty("/selectedAppId"); // Se usa para guardar en la API

            if (oFormData.isEdit) {
                console.log("Actualizando vista para App " + sAppId, oFormData);
                MessageBox.success("La vista se actualizó correctamente (simulación).");
            } else {
                console.log("Creando nueva vista para App " + sAppId, oFormData);
                MessageBox.success("Vista creada (simulación).");
            }
            
            this.onCloseDialog();
        },

        /** -------------------- Acciones eliminar -------------------- */

        onDeleteView: function () {
            const oModel = this.getView().getModel("viewModel");
            const oSelectedView = oModel.getProperty("/selectedView");
            if (!oSelectedView) return;

            MessageBox.confirm(`¿Eliminar la vista "${oSelectedView.Descripcion}"?`, {
                title: "Confirmación",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        console.log("Vista eliminada:", oSelectedView.VIEWSID);
                    }
                }.bind(this)
            });
        },

        onDeleteProcess: function () {
            const oModel = this.getView().getModel("viewModel");
            const oSelectedProcess = oModel.getProperty("/selectedProcess");
            if (!oSelectedProcess) return;

            MessageBox.confirm(`¿Eliminar el proceso "${oSelectedProcess.Descripcion}"?`, {
                title: "Confirmación",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        console.log("Proceso eliminado:", oSelectedProcess.PROCESSID);
                    }
                }.bind(this)
            });
        },

        onDeletePrivilege: function () {
            const oModel = this.getView().getModel("viewModel");
            const oSelectedPrivilege = oModel.getProperty("/selectedPrivilege");
            if (!oSelectedPrivilege) return;

            MessageBox.confirm(`¿Eliminar el privilegio "${oSelectedPrivilege.Descripcion}"?`, {
                title: "Confirmación",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        console.log("Privilegio eliminado:", oSelectedPrivilege.PRIVILEGIEID);
                    }
                }.bind(this)
            });
        },

        /** TODO: Implementar cuando tengas API para crear procesos */
        onCreateProcess: function() {
            MessageBox.information("Función para crear proceso (pendiente de implementación).");
        },

        /** TODO: Implementar cuando tengas API para crear privilegios */
        onCreatePrivilege: function() {
            MessageBox.information("Función para crear privilegio (pendiente de implementación).");
        }
    });
});
