sap.ui.define(
	[
		"sap/ui/core/mvc/Controller",
		"sap/ui/model/json/JSONModel",
		"sap/m/MessageToast",
		"sap/m/MessageBox",
		"sap/ui/core/Fragment",
		"sap/ui/model/Filter",
		"sap/ui/model/FilterOperator",
	],
	function (Controller, JSONModel, MessageToast, MessageBox, Fragment) {
		"use strict";

		return Controller.extend("com.my.users.controller.Users", {
			//Esquema del JSON para un nuevo usuario
			_getBlankUser: function () {
				return {
					USERID: "",
					USERNAME: "",
					COMPANYID: 1000,
					CEDIID: 2001,
					EMPLOYEEID: null,
					EMAIL: "",
					ALIAS: "",
					PHONENUMBER: "",
					EXTENSION: "",
				};
			},

			onInit: function () {
				// Crear modelo vacío
				const oModel = new JSONModel({
					users: [],
				});
				this.getView().setModel(oModel, "usersModel");
				const oViewModel = new JSONModel({
					selectedUser: null,
					isEditMode: false,
				});
				this.getView().setModel(oViewModel, "viewModel");
				// Cargar datos desde la API
				this._loadUsersFromAPI();
				//crear el modelo con los datos

				const oFormModel = new JSONModel(this._getBlankUser());
				this.getView().setModel(oFormModel, "formModel");
			},

			_loadUsersFromAPI: function () {
				const oModel = this.getView().getModel("usersModel");
				const sUrl =
					"http://localhost:3333/api/users/crud?ProcessType=getAll&DBServer=MongoDB&LoggedUser=AGUIZARE";

				const requestBody = {
					usuario: {},
				};

				fetch(sUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(requestBody),
				})
					.then((response) => {
						if (!response.ok) {
							throw new Error("Error HTTP: " + response.status);
						}
						return response.json();
					})
					.then((data) => {
						//  La API devuelve algo muy anidado.
						// Aquí extraemos solo el array de usuarios.
						const users = data?.value?.[0]?.data?.[0]?.dataRes || [];

						if (!Array.isArray(users) || users.length === 0) {
							MessageToast.show("No se encontraron usuarios.");
							oModel.setProperty("/users", []);
							return;
						}

						// Guardamos los usuarios en el modelo
						oModel.setProperty("/users", users);

						MessageToast.show("Usuarios cargados correctamente.");
					})
					.catch((error) => {
						console.error("Error al obtener usuarios:", error);
						MessageBox.error(
							"No se pudieron cargar los usuarios desde la API."
						);
					});
			},

			onRefresh: function () {
				this._loadUsersFromAPI();
			},

			//Modal add user
			onAddUser: function () {
				var oView = this.getView();

				// 1. Poner el flag de edición en 'false'
				this.getView().getModel("viewModel").setProperty("/isEditMode", false);

				// 2. Limpiar el 'formModel' con un usuario en blanco
				this.getView().getModel("formModel").setData(this._getBlankUser());

				// 3. Cargar el diálogo (sin cambios aquí)
				if (!this._pUserFormDialog) {
					// Renombrado de '_pAddUserDialog'
					this._pUserFormDialog = Fragment.load({
						name: "com.my.users.fragment.AddUserDialog",
						type: "XML",
						controller: this,
					}).then(function (oDialog) {
						oView.addDependent(oDialog);
						return oDialog;
					});
				}

				// 4. Abrir el diálogo
				this._pUserFormDialog.then(function (oDialog) {
					oDialog.open();
				});
			},

			onEditUser: function () {
				var oView = this.getView();
				const oSelectedUser = this.getView()
					.getModel("viewModel")
					.getProperty("/selectedUser");

				// 1. Poner el flag de edición en 'true'
				this.getView().getModel("viewModel").setProperty("/isEditMode", true);

				// 2. (LA CLAVE) Cargar los datos del usuario seleccionado en el 'formModel'
				// Usamos JSON.parse/stringify para hacer una COPIA PROFUNDA.
				// Si no, al editar el formulario, ¡editarías la tabla directamente!
				this.getView()
					.getModel("formModel")
					.setData(JSON.parse(JSON.stringify(oSelectedUser)));

				// 3. Cargar y abrir el MISMO diálogo
				if (!this._pUserFormDialog) {
					this._pUserFormDialog = Fragment.load({
						name: "com.my.users.fragment.AddUserDialog",
						type: "XML",
						controller: this,
					}).then(function (oDialog) {
						oView.addDependent(oDialog);
						return oDialog;
					});
				}
				this._pUserFormDialog.then(function (oDialog) {
					oDialog.open();
				});
			},

			// --- Renombrado para que coincida con el nuevo propósito ---
			onCancelForm: function () {
				this._pUserFormDialog.then(function (oDialog) {
					oDialog.close();
				});
			},

			// --- 'SAVE' MODIFICADO (Ahora es 'Crear' O 'Actualizar') ---
			onSaveUser: function () {
				const bIsEditMode = this.getView()
					.getModel("viewModel")
					.getProperty("/isEditMode");

				if (bIsEditMode) {
					this._updateUser();
				} else {
					this._createUser();
				}
			},

			_createUser: function () {
				const oNewUserData = this.getView().getModel("formModel").getData(); // <-- Usa 'formModel'

				if (
					!oNewUserData.USERID ||
					!oNewUserData.USERNAME ||
					!oNewUserData.EMAIL
				) {
					MessageBox.error("Por favor, completa todos los campos requeridos.");
					return;
				}

				try {
					oNewUserData.COMPANYID = parseInt(oNewUserData.COMPANYID, 10);
					oNewUserData.CEDIID = parseInt(oNewUserData.CEDIID, 10);
					oNewUserData.EMPLOYEEID = parseInt(oNewUserData.EMPLOYEEID, 10);
				} catch (e) {
					MessageBox.error("Por favor, introduce números válidos para IDs.");
					return;
				}

				const oFinalPayload = { usuario: oNewUserData };
				const sUrl =
					"http://localhost:3333/api/users/crud?ProcessType=postUsuario&DBServer=MongoDB&LoggedUser=AGUIZARE";

				// ... (Tu 'fetch' para CREAR, sin cambios) ...
				fetch(sUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(oFinalPayload),
				})
					.then((response) => {
						if (!response.ok) {
							return response.json().then((errorData) => {
								throw new Error(
									errorData.message || "Error del servidor: " + response.status
								);
							});
						}
						return response.json();
					})
					.then((data) => {
						MessageToast.show("Usuario agregado correctamente.");

						this._loadUsersFromAPI();

						this.onCancelForm();
					})
					.catch((error) => {
						console.error("Error al guardar usuario:", error);
						MessageBox.error("No se pudo crear el usuario: " + error.message);
					})
					.finally(() => {});
			},

			// Lógica de 'Actualizar' (NUEVA)
			_updateUser: function () {
				const oUpdatedUserData = this.getView().getModel("formModel").getData();
				delete oUpdatedUserData._id;
				delete oUpdatedUserData.REGUSER;
				delete oUpdatedUserData.MODUSER;
				delete oUpdatedUserData.ACTIVED;
				delete oUpdatedUserData.DELETED;
				delete oUpdatedUserData.REGDATE;
				delete oUpdatedUserData.REGTIME;
				delete oUpdatedUserData.MODDATE;
				delete oUpdatedUserData.MODTIME;
				delete oUpdatedUserData.__v;

				console.log(oUpdatedUserData);
				const oFinalPayload = { usuario: oUpdatedUserData };

				// 🔹 URL de Actualización (¡Adivinando 'putUsuario'!)
				const sUrl =
					"http://localhost:3333/api/users/crud?ProcessType=updateOne&DBServer=MongoDB&LoggedUser=AGUIZARE";

				fetch(sUrl, {
					method: "POST", // O "PUT", según tu API
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(oFinalPayload),
				})
					.then((response) => {
						if (!response.ok) {
							return response.json().then((err) => {
								throw new Error(err.message || "Error del servidor");
							});
						}
						return response.json();
					})
					.then((data) => {
						MessageToast.show("Usuario actualizado correctamente.");
						this._loadUsersFromAPI(); // Refrescar la tabla
						this.getView()
							.getModel("viewModel")
							.setProperty("/selectedUser", null); // Limpiar selección
						this.onCancelForm(); // Cerrar el diálogo
					})
					.catch((error) => {
						console.error("Error al actualizar usuario:", error);
						MessageBox.error(
							"No se pudo actualizar el usuario: " + error.message
						);
					});
			},

			//Barra de busqueda
			onSearch: function (oEvent) {
				const sQuery = oEvent.getParameter("query");
				const oTable = this.byId("usersTable");
				const oBinding = oTable.getBinding("items");

				if (sQuery) {
					// Filtramos por USERNAME. Puedes añadir más campos.
					const oFilter = new Filter({
						path: "USERNAME",
						operator: FilterOperator.Contains,
						value1: sQuery,
					});
					oBinding.filter([oFilter]);
				} else {
					oBinding.filter([]); // Quitar filtro si la búsqueda está vacía
				}
			},

			// Obtenemos el objeto 'usuario' de la fila seleccionada
			onRowSelect: function (oEvent) {
				const oContext = oEvent
					.getParameter("listItem")
					.getBindingContext("usersModel");
				const oSelectedUser = oContext.getObject();

				// Guardamos ese objeto en nuestro 'viewModel'
				this.getView()
					.getModel("viewModel")
					.setProperty("/selectedUser", oSelectedUser);
			},

			//Logica de delete
			onDeleteUser: function () {
				const oSelectedUser = this.getView()
					.getModel("viewModel")
					.getProperty("/selectedUser");

				// Verificación (aunque el botón debería estar deshabilitado)
				if (!oSelectedUser) {
					MessageToast.show("Por favor, selecciona un usuario para eliminar.");
					return;
				}

				// Guardamos el usuario a eliminar en un modelo para que el fragmento lo lea
				// (Basado en tu fragmento que usa 'UserModelDelete')
				if (!this.getView().getModel("UserModelDelete")) {
					this.getView().setModel(new JSONModel(), "UserModelDelete");
				}
				this.getView().getModel("UserModelDelete").setData(oSelectedUser);

				// Cargar y abrir el diálogo de confirmación
				var oView = this.getView();
				if (!this._pDeleteUserDialog) {
					this._pDeleteUserDialog = Fragment.load({
						name: "com.my.users.fragment.DeleteUserDialog", // Asegúrate que esta sea la ruta correcta
						type: "XML",
						controller: this,
					}).then(function (oDialog) {
						oView.addDependent(oDialog);
						return oDialog;
					});
				}
				this._pDeleteUserDialog.then((oDialog) => oDialog.open());
			},

			/**
			 * Cierra el diálogo de confirmación de borrado
			 */
			onCancelDeleteUser: function () {
				this._pDeleteUserDialog.then((oDialog) => oDialog.close());
			},

			/**
			 * Se llama desde el botón 'Eliminar' (rojo) en el diálogo.
			 * Ejecuta la lógica de borrado.
			 */
			onConfirmDelete: function () {
				const oUserToDelete = this.getView()
					.getModel("UserModelDelete")
					.getData();
				const sUrl =
					"http://localhost:3333/api/users/crud?ProcessType=deleteUsuario&DBServer=MongoDB&LoggedUser=AGUIZARE"; // 🔹 URL de borrado

				const oFinalPayload = {
					usuario: {
						USERID: oUserToDelete.USERID,
					},
				};

				fetch(sUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(oFinalPayload),
				})
					.then((response) => {
						if (!response.ok) {
							throw new Error("Error al eliminar el usuario");
						}
						return response.json();
					})
					.then((data) => {
						MessageToast.show("Usuario eliminado correctamente.");
						this._loadUsersFromAPI(); // Refrescar la tabla
						this.getView()
							.getModel("viewModel")
							.setProperty("/selectedUser", null); // Limpiar selección
						this.onCancelDeleteUser(); // Cerrar el diálogo
					})
					.catch((error) => {
						MessageBox.error("Error: " + error.message);
					})
					.finally(() => {});
			},
		});
	}
);
