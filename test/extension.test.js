/* global suite, test */

//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
let assert = require('assert');

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
let vscode = require('vscode');
let myExtension = require('../extension');
let main = require('../src/main');
let path = require('path');

// Defines a Mocha test suite to group tests of similar kind together
suite('main', function() {
	/**
	 * A helper function to return a vscode object imitation.
	 *
	 * @param {Object} [options]
	 * @param {Number} [options.line] Current, focused line number.
	 * @param {String} [options.projectDirectory] Absolute path to the project directory.
	 * @param {String} [options.filePath] File path **relative to** `projectDirectory`.
	 * @returns {Object} An `vscode` alike object.
	 */
	function getVsCodeMock( options ) {
		let editorMock = {
			selection: {
				active: {
					line: options.line || 1
				}
			},
			document: {
				fileName: options.filePath ? ( options.projectDirectory + path.sep + options.filePath ) :
					'F:\\my\\workspace\\foo\\subdir1\\subdir2\\myFileName.txt'
			}
		};

		return vsCodeMock = {
			workspace: {
				rootPath: options.projectDirectory || 'F:\\my\\workspace\\foo'
			},
			window: {
				activeTextEditor: editorMock
			}
		};
	}

	main._getGitInfo = function( vscode ) {
		// Stub the method to always have the same results.
		return {
			branch:'master',
			remote:'origin',
			url:'git@github.com:foo/bar-baz.git',
			githubUrl:'https://github.com/foo/bar-baz'
		};
	}

	test('getGithubUrl - windows path', function() {
		let vsCodeMock = getVsCodeMock( {
			line: 4
		} );
		let url = main.getGithubUrl( vsCodeMock );

		assert.equal(url, 'https://github.com/foo/bar-baz/blob/master/subdir1/subdir2/myFileName.txt#L5', 'Invalid URL returned');
	});

	test('getGithubUrl - windows path file directly in project dir', function() {
		let vsCodeMock = getVsCodeMock( {
			line: 102,
			projectDirectory: 'T:\foo',
			filePath: 'bar.md'
		} );
		let url = main.getGithubUrl( vsCodeMock );

		assert.equal(url, 'https://github.com/foo/bar-baz/blob/master/bar.md#L103', 'Invalid URL returned');
	});
});