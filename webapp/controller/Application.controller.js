sap.ui.define(
	[
		"./BaseController",
		"sap/m/MessageBox",
		"sap/ui/model/json/JSONModel",
		"sap/ui/model/Filter",
		"sap/ui/model/FilterOperator",
		"sap/ui/core/Fragment",
	],
	function (
		BaseController,
		MessageBox,
		JSONModel,
		Filter,
		FilterOperator,
		Fragment
	) {
		"use strict";

		return BaseController.extend("com.my.users.controller.Application", {
			_oViewDialog: null,
			_sBaseUrl: "http://localhost:3333/api",
			_sApiParams: "dbserver=MongoDB&LoggedUser=AGUIZARE",

			onInit: function () {
				// Modelo que contiene toda la data del módulo
				const oViewModel = new JSONModel({
					applications: [],       // Lista de aplicaciones
					selectedAppId: null,    // Aplicación seleccionada

					masterViews: [],        // Lista de vistas maestras (todas las posibles)
					masterDataMap: {},      // Mapa App → Vistas asignadas → Procesos

					views: [],              // Vistas mostradas en tabla (mezcla de maestras y asignadas)
					processesMap: {},       // Mapa Vista → Procesos asignados
					privilegesMap: {},      // Mapa Proceso → Privilegios asignados

					filteredProcesses: [],  // Procesos de la vista seleccionada
					filteredPrivileges: [], // Privilegios del proceso seleccionado
					selectedView: null,
					selectedProcess: null,
					selectedPrivilege: null,

					loading: false,         // Bandera para mostrar/loading
					loadError: null,        // Error si algo falla al cargar

					viewFormData: {         // Datos del formulario para crear/editar vista
						isEdit: false,
						VIEWSID: "",
						Descripcion: "",
					},

					// Mock temporal para pruebas en UI
					mockPrivileges: {
						PROC001_UPDATED: [{ PRIVILEGIEID: "PR_UPD", Descripcion: "Actualizar" }],
						PROC004: [{ PRIVILEGIEID: "PR_004", Descripcion: "Proceso 4" }],
						PROC_FINAL_01: [{ PRIVILEGIEID: "PR_F01", Descripcion: "Proceso Final" }],
						PROC001: [{ PRIVILEGIEID: "PR_001", Descripcion: "Proceso 1" }],
						PROC002: [{ PRIVILEGIEID: "PR_002", Descripcion: "Proceso 2" }],
					},
				});

				this.getView().setModel(oViewModel, "viewModel");

				// Al iniciar la vista, cargamos aplicaciones y vistas maestras
				this.loadInitialData();
			},

			/**
			 * Carga inicial de datos: aplicaciones + vistas disponibles
			 */
			loadInitialData: async function () {
				const oModel = this.getView().getModel("viewModel");
				oModel.setProperty("/loading", true);

				try {
					// Ejecuta ambas consultas al mismo tiempo para mayor velocidad
					const [oAppData, aMasterViews] = await Promise.all([
						this._fetchAppData(),
						this._fetchMasterViews(),
					]);

					oModel.setProperty("/applications", oAppData.applications);
					oModel.setProperty("/masterDataMap", oAppData.masterDataMap);
					oModel.setProperty("/masterViews", aMasterViews);
					oModel.setProperty("/privilegesMap", oModel.getProperty("/mockPrivileges"));
				} catch (err) {
					oModel.setProperty("/loadError", err.message);
					MessageBox.error("Error al cargar los datos: " + err.message);
				} finally {
					oModel.setProperty("/loading", false);
				}
			},

			/**
			 * Evento cuando el usuario cambia de aplicación.
			 * Aquí reconstruimos las vistas y procesos asignados.
			 */
			onAppSelectionChange: function (oEvent) {
				const oModel = this.getView().getModel("viewModel");
				const sSelectedAppId = oEvent.getParameter("selectedItem").getKey();
				oModel.setProperty("/selectedAppId", sSelectedAppId);

				this._clearSelections(); // limpiamos la selección en tablas

				try {
					const oMasterMap = oModel.getProperty("/masterDataMap");
					const aMasterViews = oModel.getProperty("/masterViews");

					// Datos de la app seleccionada o valores vacíos si no tiene nada asignado
					const oAppData = oMasterMap[sSelectedAppId] || {
						assignedViews: [],
						processesMap: {},
					};

					const aAssignedViewIds = new Set(
						oAppData.assignedViews.map((v) => v.VIEWSID)
					);

					// Construimos estructura para la tabla de vistas
					const aTableViews = aMasterViews.map((oMasterView) => ({
						...oMasterView,
						isAssigned: aAssignedViewIds.has(oMasterView.VIEWSID),
						_busy: false,
					}));

					oModel.setProperty("/views", aTableViews);
					oModel.setProperty("/processesMap", oAppData.processesMap);
				} catch (err) {
					MessageBox.error("Error al procesar los datos: " + err.message);
					oModel.setProperty("/views", []);
				}
			},

			/**
			 * Marca o desmarca una vista como asignada a la aplicación
			 */
			onAssignViewToggle: async function (oEvent) {
				const oModel = this.getView().getModel("viewModel");
				const bSelected = oEvent.getParameter("selected");
				const oContext = oEvent.getSource().getBindingContext("viewModel");
				const oView = oContext.getObject();
				const sAppId = oModel.getProperty("/selectedAppId");

				if (!sAppId) return;

				// Indicamos que esa fila está "ocupada" mientras se realiza la operación
				oModel.setProperty(oContext.getPath() + "/_busy", true);

				try {
					if (bSelected) {
						await this._assignViewToApp(sAppId, oView.VIEWSID);
						MessageBox.success(`Vista "${oView.Descripcion}" asignada.`);

						// Al asignar la vista, consultamos sus procesos
						const aProcesses = await this._fetchProcessesForView(oView.VIEWSID);
						oModel.setProperty(`/processesMap/${oView.VIEWSID}`, aProcesses);
					} else {
						await this._unassignViewFromApp(sAppId, oView.VIEWSID);
						MessageBox.warning(`Vista "${oView.Descripcion}" desasignada.`);

						// Al desasignar, limpiamos procesos asociados de pantalla
						oModel.setProperty(`/processesMap/${oView.VIEWSID}`, []);
						if (oModel.getProperty("/selectedView")?.VIEWSID === oView.VIEWSID) {
							this._clearProcessAndPrivilegeSelection();
						}
					}
				} catch (err) {
					MessageBox.error("Error al actualizar la asignación: " + err.message);

					// Si falló, revertimos checkbox visualmente
					oModel.setProperty(oContext.getPath() + "/isAssigned", !bSelected);
				} finally {
					oModel.setProperty(oContext.getPath() + "/_busy", false);
				}
			},

			/**
			 * Cuando el usuario selecciona una vista, se muestran los procesos asociados
			 */
			onViewSelectionChange: function (oEvent) {
				const oModel = this.getView().getModel("viewModel");
				const oContext = oEvent.getParameter("rowContext");

				this._clearProcessAndPrivilegeSelection();

				if (!oContext) return;

				const oSelectedView = oContext.getObject();
				oModel.setProperty("/selectedView", oSelectedView);

				if (!oSelectedView.isAssigned) {
					MessageBox.information(
						"Esta vista aún no está asignada. Activa la casilla para gestionarla."
					);
					this.byId("viewsTable").clearSelection();
					oModel.setProperty("/selectedView", null);
					return;
				}

				oModel.setProperty(
					"/filteredProcesses",
					oModel.getProperty("/processesMap")[oSelectedView.VIEWSID] || []
				);
			},

			/**
			 * Al seleccionar un proceso, mostramos sus privilegios
			 */
			onProcessSelectionChange: function (oEvent) {
				const oModel = this.getView().getModel("viewModel");
				const oContext = oEvent.getParameter("rowContext");

				oModel.setProperty("/filteredPrivileges", []);
				oModel.setProperty("/selectedPrivilege", null);
				this.byId("privilegesTable").clearSelection();

				if (!oContext) return;

				const oSelectedProcess = oContext.getObject();
				oModel.setProperty("/selectedProcess", oSelectedProcess);

				oModel.setProperty(
					"/filteredPrivileges",
					oModel.getProperty("/privilegesMap")[oSelectedProcess.PROCESSID] || []
				);
			},

			onPrivilegeSelectionChange: function (oEvent) {
				const oContext = oEvent.getParameter("rowContext");
				this.getView()
					.getModel("viewModel")
					.setProperty(
						"/selectedPrivilege",
						oContext ? oContext.getObject() : null
					);
			},

			/**
			 * Filtro de búsqueda de vistas por ID o descripción
			 */
			onSearchViews: function (oEvent) {
				const sQuery = oEvent.getParameter("query").toLowerCase();
				const aFilters = [];

				if (sQuery) {
					aFilters.push(
						new Filter({
							filters: [
								new Filter("VIEWSID", FilterOperator.Contains, sQuery),
								new Filter("Descripcion", FilterOperator.Contains, sQuery),
							],
							and: false,
						})
					);
				}

				this.byId("viewsTable").getBinding("rows").filter(aFilters);
			},

			/**
			 * Lazy loading del diálogo de alta/edición de vista
			 */
			_getDialog: function () {
				if (!this._oViewDialog) {
					this._oViewDialog = this.loadFragment({
						id: this.getView().getId(),
						name: "com.my.users.fragment.ViewDialog",
						controller: this,
					}).then((oDialog) => {
						this.getView().addDependent(oDialog);
						return oDialog;
					});
				}
				return this._oViewDialog;
			},

			/**
			 * Abrimos el diálogo para crear una vista
			 */
			onCreateView: function () {
				this.getView().getModel("viewModel").setProperty("/viewFormData", {
					isEdit: false,
					VIEWSID: "",
					Descripcion: "",
				});

				this._getDialog().then((oDialog) => {
					oDialog.setTitle("Crear Nueva Vista");
					oDialog.open();
				});
			},

			/**
			 * Abre el diálogo precargando los valores para editar una vista existente
			 */
			onEditView: function () {
				const oSelectedView = this.getView()
					.getModel("viewModel")
					.getProperty("/selectedView");

				if (!oSelectedView) {
					MessageBox.warning("Selecciona una vista para editar.");
					return;
				}

				this.getView()
					.getModel("viewModel")
					.setProperty("/viewFormData", {
						isEdit: true,
						...oSelectedView,
					});

				this._getDialog().then((oDialog) => {
					oDialog.setTitle("Editar Vista");
					oDialog.open();
				});
			},

			onCloseDialog: function () {
				this._getDialog().then((oDialog) => oDialog.close());
			},

			/**
			 * Guarda los cambios (crear o editar vista)
			 */
			onSaveView: async function () {
				const oModel = this.getView().getModel("viewModel");
				const oFormData = oModel.getProperty("/viewFormData");

				try {
					if (oFormData.isEdit) {
						await this._updateMasterView(oFormData);
						MessageBox.success("Vista actualizada.");
					} else {
						await this._createMasterView(oFormData);
						MessageBox.success("Vista creada.");
					}

					this.onCloseDialog();

					// Actualizamos la tabla de vistas maestras
					const aMasterViews = await this._fetchMasterViews();
					oModel.setProperty("/masterViews", aMasterViews);

					// Si había una aplicación seleccionada, refrescamos el selector
					if (oModel.getProperty("/selectedAppId")) {
						this.byId("appSelector").fireEvent("change", {
							selectedItem: this.byId("appSelector").getSelectedItem(),
						});
					}
				} catch (err) {
					MessageBox.error(err.message || "Error al guardar.");
				}
			},

			/**
			 * Guarda una nueva vista en la base de datos
			 */
			_createMasterView: async function (oViewData) {
				const sApiRoute = `${this._sBaseUrl}/views/crud?ProcessType=addView&${this._sApiParams}`;

				const oBody = {
					viewId: oViewData.VIEWSID,
					data: {
						VIEWSID: oViewData.VIEWSID,
						DESCRIPCION: oViewData.Descripcion,
					},
				};

				const res = await fetch(sApiRoute, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(oBody),
				});

				if (!res.ok) {
					let msg = `Error HTTP ${res.status}`;
					try {
						msg = (await res.json()).messageUSR || msg;
					} catch (e) {}
					throw new Error(msg);
				}

				const data = await res.json();
				if (!data.success) throw new Error(data.messageUSR);

				return data;
			},

			/**
			 * Eliminar vista (pendiente de implementación API real)
			 */
			onDeleteView: function () {
				const oModel = this.getView().getModel("viewModel");
				const oSelectedView = oModel.getProperty("/selectedView");
				if (!oSelectedView) return;

				MessageBox.confirm(
					`¿Eliminar la vista "${oSelectedView.Descripcion}"?`,
					{
						title: "Confirmación",
						onClose: function (sAction) {
							if (sAction === MessageBox.Action.OK) {
								console.log("Vista eliminada:", oSelectedView.VIEWSID);
							}
						}.bind(this),
					}
				);
			},

			onDeleteProcess: function () {
				const oSelectedProcess =
					this.getView().getModel("viewModel").getProperty("/selectedProcess");
				if (!oSelectedProcess) return;

				MessageBox.confirm(
					`¿Eliminar el proceso "${oSelectedProcess.Descripcion}"?`,
					{
						title: "Confirmación",
						onClose: (sAction) => {
							if (sAction === MessageBox.Action.OK) {
								console.log("Proceso eliminado:", oSelectedProcess.PROCESSID);
							}
						},
					}
				);
			},

			onDeletePrivilege: function () {
				const oSelectedPrivilege =
					this.getView().getModel("viewModel").getProperty("/selectedPrivilege");
				if (!oSelectedPrivilege) return;

				MessageBox.confirm(
					`¿Eliminar el privilegio "${oSelectedPrivilege.Descripcion}"?`,
					{
						title: "Confirmación",
						onClose: (sAction) => {
							if (sAction === MessageBox.Action.OK) {
								console.log(
									"Privilegio eliminado:",
									oSelectedPrivilege.PRIVILEGIEID
								);
							}
						},
					}
				);
			},

			onCreateProcess: function () {
				MessageBox.information("Función para crear proceso.");
			},

			onCreatePrivilege: function () {
				MessageBox.information("Función para crear privilegio.");
			},

			/**
			 * Resetea toda la selección de tablas
			 */
			_clearSelections: function () {
				const oModel = this.getView().getModel("viewModel");
				oModel.setProperty("/views", []);
				oModel.setProperty("/selectedView", null);
				this._clearProcessAndPrivilegeSelection();
			},

			/**
			 * Resetea selección de procesos y privilegios
			 */
			_clearProcessAndPrivilegeSelection: function () {
				const oModel = this.getView().getModel("viewModel");
				oModel.setProperty("/selectedProcess", null);
				oModel.setProperty("/selectedPrivilege", null);
				oModel.setProperty("/filteredProcesses", []);
				oModel.setProperty("/filteredPrivileges", []);
				this.byId("processesTable").clearSelection();
				this.byId("privilegesTable").clearSelection();
			},

			/**
			 * Carga aplicaciones desde la API y estructura el resultado
			 */
			_fetchAppData: async function () {
				const sApiRoute = `${this._sBaseUrl}/application/crud?ProcessType=getAplications&${this._sApiParams}`;

				const res = await fetch(sApiRoute, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({}),
				});

				if (!res.ok) throw new Error(`HTTP ${res.status}`);

				const data = await res.json();
				if (!data.success || !data.data[0].dataRes)
					throw new Error(data.messageUSR);

				const aAllAppsData = data.data[0].dataRes;

				const aApplications = [];
				const oMasterMap = {};

				// Recorremos todas las apps para construir estructuras listas para UI
				aAllAppsData.forEach((app) => {
					aApplications.push({
						APPID: app.APPID,
						NAME: app.NAME,
					});

					const aAssignedViews = [];
					const oProcessesMap = {};

					(app.VIEWS || []).forEach((view) => {
						aAssignedViews.push({ VIEWSID: view.VIEWSID });

						const aProcesses = [];
						(view.PROCESS || []).forEach((proc) => {
							aProcesses.push({
								PROCESSID: proc.PROCESSID,
								Descripcion: proc.PROCESSID,
							});
						});

						oProcessesMap[view.VIEWSID] = aProcesses;
					});

					oMasterMap[app.APPID] = {
						assignedViews: aAssignedViews,
						processesMap: oProcessesMap,
					};
				});

				return { applications: aApplications, masterDataMap: oMasterMap };
			},

			/**
			 * Obtiene vistas maestras desde la API
			 */
			_fetchMasterViews: async function () {
				const sApiRoute = `${this._sBaseUrl}/views/crud?ProcessType=getAll&${this._sApiParams}`;

				const res = await fetch(sApiRoute, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({}),
				});

				if (!res.ok) throw new Error(`HTTP ${res.status}`);

				const data = await res.json();

				if (!data.success || !data.data[0].dataRes)
					throw new Error(data.messageUSR);

				return data.data[0].dataRes.map((view) => ({
					VIEWSID: view.VIEWSID,
					Descripcion: view.DESCRIPCION,
				}));
			},

			/**
			 * Simulación de carga de procesos (puede conectarse a API después)
			 */
			_fetchProcessesForView: async function (sViewId) {
				if (sViewId === "VIEW001") {
					return [
						{ PROCESSID: "PROC001", Descripcion: "PROC001" },
						{ PROCESSID: "PROC002", Descripcion: "PROC002" },
					];
				}

				if (sViewId === "VIEW003") {
					return [
						{ PROCESSID: "PROC001_UPDATED", Descripcion: "PROC001_UPDATED" },
						{ PROCESSID: "PROC004", Descripcion: "PROC004" },
					];
				}

				return [];
			},

			/**
			 * Guardar relación App -> Vista en el backend
			 */
			_assignViewToApp: async function (sAppId, sViewId) {
				const sApiRoute = `${this._sBaseUrl}/application/crud?ProcessType=addView&${this._sApiParams}`;

				const oBody = {
					appId: sAppId,
					viewId: "String",
					processId: "String",
					data: {
						VIEWSID: sViewId,
					},
				};

				const res = await fetch(sApiRoute, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(oBody),
				});

				if (!res.ok) {
					let msg = `Error HTTP ${res.status}`;
					try {
						msg = (await res.json()).messageUSR || msg;
					} catch (e) {}
					throw new Error(msg);
				}

				const data = await res.json();
				if (!data.success) throw new Error(data.messageUSR);
				return data;
			},

			/**
			 * Eliminar relación App -> Vista del backend
			 */
			_unassignViewFromApp: async function (sAppId, sViewId) {
				const sApiRoute = `${this._sBaseUrl}/application/crud?ProcessType=deleteHardView&${this._sApiParams}`;

				const oBody = {
					appId: sAppId,
					viewId: sViewId,
					processId: "String",
				};

				const res = await fetch(sApiRoute, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(oBody),
				});

				if (!res.ok) {
					let msg = `Error HTTP ${res.status}`;
					try {
						msg = (await res.json()).messageUSR || msg;
					} catch (e) {}
					throw new Error(msg);
				}

				const data = await res.json();
				if (!data.success) throw new Error(data.messageUSR);
				return data;
			},
		});
	}
);
