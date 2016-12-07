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
	 * @param {Number} [options.startLine] Current, focused line number.
	 * @param {Number} [options.endLine] Line number where the current selection ends.
	 * @param {String} [options.projectDirectory] Absolute path to the project directory.
	 * @param {String} [options.filePath] File path **relative to** `projectDirectory`.
	 * @returns {Object} An `vscode` alike object.
	 */
	function getVsCodeMock( options ) {
		let editorMock = {
			selection: {
				active: {
					line: options.startLine !== undefined ? options.startLine : 1
				},
				start: {
					line: options.startLine !== undefined ? options.startLine : 1
				},
				end: {
				}
			},
			document: {
				fileName: options.filePath ? ( options.projectDirectory + path.sep + options.filePath ) :
					'F:\\my\\workspace\\foo\\subdir1\\subdir2\\myFileName.txt'
			}
		};

		if ( options.endLine !== undefined ) {
			editorMock.selection.end.line = options.endLine;
		} else {
			// If endLine is unspecified just set it to the same as start line.
			editorMock.selection.end.line = editorMock.selection.start.line;
		}

		// And then we can determine if the selection is collapsed or not.
		editorMock.selection.isSingleLine = editorMock.selection.start.line == editorMock.selection.end.line;

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
			startLine: 4
		} );
		let url = main.getGithubUrl( vsCodeMock );

		assert.equal(url, 'https://github.com/foo/bar-baz/blob/master/subdir1/subdir2/myFileName.txt#L5', 'Invalid URL returned');
	});

	test('getGithubUrl - windows path file directly in project dir', function() {
		let vsCodeMock = getVsCodeMock( {
			startLine: 102,
			projectDirectory: 'T:\foo',
			filePath: 'bar.md'
		} );
		let url = main.getGithubUrl( vsCodeMock );

		assert.equal(url, 'https://github.com/foo/bar-baz/blob/master/bar.md#L103', 'Invalid URL returned');
	});

	test('getGithubUrl - ranged selection', function() {
		// Test a case when the selection is spanned across multiple lines.
		let vsCodeMock = getVsCodeMock( {
			startLine: 30,
			endLine: 40,
			projectDirectory: 'T:\foo',
			filePath: 'bar.md'
		} );
		let url = main.getGithubUrl( vsCodeMock );

		assert.equal(url, 'https://github.com/foo/bar-baz/blob/master/bar.md#L31-L41', 'Invalid URL returned');
	});

	test('getGithubUrl - same active.line as end.line', function() {
		// Tehere might be a case, where selection.active.line will be the same as selection.end.line. It caused a problem at one point.
		let vsCodeMock = getVsCodeMock( {
			startLine: 1,
			endLine: 5,
			projectDirectory: 'T:\foo',
			filePath: 'bar.md'
		} );

		vsCodeMock.window.activeTextEditor.selection.active.line = 5;

		let url = main.getGithubUrl( vsCodeMock );

		assert.equal(url, 'https://github.com/foo/bar-baz/blob/master/bar.md#L2-L6', 'Invalid URL returned');
	});
});