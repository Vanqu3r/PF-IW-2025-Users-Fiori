sap.ui.define(function () {
	"use strict";

	return {
		name: "QUnit test suite for the UI5 Application: com.my.users",
		defaults: {
			page: "ui5://test-resources/com/my/users/Test.qunit.html?testsuite={suite}&test={name}",
			qunit: {
				version: 2
			},
			sinon: {
				version: 1
			},
			ui5: {
				language: "EN",
				theme: "sap_horizon"
			},
			coverage: {
				only: "com/my/users/",
				never: "test-resources/com/my/users/"
			},
			loader: {
				paths: {
					"com/my/users": "../"
				}
			}
		},
		tests: {
			"unit/unitTests": {
				title: "Unit tests for com.my.users"
			},
			"integration/opaTests": {
				title: "Integration tests for com.my.users"
			}
		}
	};
});
