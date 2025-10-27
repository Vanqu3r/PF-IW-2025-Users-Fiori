sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
  "use strict";

  return Controller.extend("com.my.users.controller.Users", {

    onInit: function () {
      // Crear modelo vacío
      const oModel = new JSONModel({
        users: []
      });
      this.getView().setModel(oModel, "usersModel");

      // Cargar datos desde la API
      this._loadUsersFromAPI();
    },

    _loadUsersFromAPI: function () {
      const oModel = this.getView().getModel("usersModel");
      const sUrl = "http://localhost:3333/api/users/crud?ProcessType=getAll&DBServer=MongoDB&LoggedUser=AGUIZARE"; // 🔹 Cambia por tu endpoint real

      // 🔹 Estructura del body que tu API espera
      const requestBody = {
        usuario: {} // Si tu backend necesita más datos, agrégalos aquí
      };

      fetch(sUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Error HTTP: " + response.status);
          }
          return response.json();
        })
        .then((data) => {
          // 🔹 La API devuelve algo muy anidado.
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
          MessageBox.error("No se pudieron cargar los usuarios desde la API.");
        });
    },

    onRefresh: function () {
      this._loadUsersFromAPI();
    }

  });
});
