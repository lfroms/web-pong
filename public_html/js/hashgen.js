/*

	Author: Lukas Romsicki

	Desc: Random Hash Generation
	Func: This code provides functionality for generating random hashes for user connections.

*/

function Generator() {};

// Generate a random hash (current time and random number)
Generator.prototype.rand = Math.floor(Math.random() * 26) + Date.now();

// Return the new hash
Generator.prototype.newHash = function () {
    return this.rand++;
};

// Object definition
let hash = new Generator();
