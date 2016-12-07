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

// Defines a Mocha test suite to group tests of similar kind together
suite('main', function() {
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
		let editorMock = {
			selection: {
				active: {
					line: 4
				}
			},
			document: {
				fileName: 'F:\\my\\workspace\\foo\\subdir1\\subdir2\\myFileName.txt'
			}
		};
		let vsCodeMock = {
			workspace: {
				rootPath: 'F:\\my\\workspace\\foo'
			},
			window: {
				activeTextEditor: editorMock
			}
		};
		let url = main.getGithubUrl( vsCodeMock );

		assert.equal('https://github.com/foo/bar-baz/blob/master/subdir1/subdir2/myFileName.txt#L5', url, 'Invalid URL returned');
	});
});