const path = require("node:path");
const fs = require("fs-plus");
const temp = require("temp");
const parser = require("cson-parser");
const CSON = require("../src/cson.js");

function readFile(filePath, callback) {
  let done = jasmine.createSpy("readFile callback");
  expect(CSON.readFile(filePath, done)).toBeUndefined();
  waitsFor(() => {
    return done.callCount === 1;
  });
  runs(() => {
    callback.apply(null, done.argsForCall[0]);
  });
}

describe("CSON", function() {
  beforeEach(function() {
    CSON.setCacheDir(null);
    CSON.resetCacheStats();
  });
  describe(".stringify(object)", function() {
    describe("when the object is undefined", function() {
      it("returns undefined", function() {
        expect(CSON.stringify(undefined)).toBe(undefined);
      });
    });
    describe("when the object is a function", function() {
      it("returns undefined", function() {
        expect(CSON.stringify(function() {
          'function';
        })).toBe(undefined);
      });
    });
    describe("when the object contains a function", function() {
      it("it gets filtered away, when not providing a visitor function", function() {
        expect(CSON.stringify({
          a: function() {
            'function';
          }
        })).toBe('{}');
      });
    });
    describe("when formatting an undefined key", function() {
      it("does not include the key in the formatted CSON", function() {
        expect(CSON.stringify({
          b: 1,
          c: undefined
        })).toBe('b: 1');
      });
    });
    describe("when formatting a string", function() {
      it("returns formatted CSON", function() {
        expect(CSON.stringify({
          a: 'b'
        })).toBe('a: "b"');
      });
      it("doesn't escape single quotes", function() {
        expect(CSON.stringify({
          a: "'b'"
        })).toBe('a: "\'b\'"');
      });
      it("escapes double quotes", function() {
        expect(CSON.stringify({
          a: '"b"'
        })).toBe('a: "\\"b\\""');
      });
      it("turns strings with newlines into triple-apostrophe strings", function() {
        expect(CSON.stringify("a\nb")).toBe("'''\n  a\n  b\n'''");
      });
      it("escapes triple-apostrophes in triple-apostrophe strings", function() {
        expect(CSON.stringify("a\n'''")).toBe("'''\n  a\n  \\\'''\n'''");
      });
    });
    describe("when formatting a boolean", function() {
      it("returns formatted CSON", function() {
        expect(CSON.stringify(true)).toBe('true');
        expect(CSON.stringify(false)).toBe('false');
        expect(CSON.stringify({
          a: true
        })).toBe('a: true');
        expect(CSON.stringify({
          a: false
        })).toBe('a: false');
      });
    });
    describe("when formatting a number", function() {
      it("returns formatted CSON", function() {
        expect(CSON.stringify(54321.012345)).toBe('54321.012345');
        expect(CSON.stringify({
          a: 14
        })).toBe('a: 14');
        expect(CSON.stringify({
          a: 1.23
        })).toBe('a: 1.23');
      });
    });
    describe("when formatting null", function() {
      it("returns formatted CSON", function() {
        expect(CSON.stringify(null)).toBe('null');
        expect(CSON.stringify({
          a: null
        })).toBe('a: null');
      });
    });
    describe("when formatting an array", function() {
      describe("when the array is empty", function() {
        it("puts the array on a single line", function() {
          expect(CSON.stringify([])).toBe("[]");
        });
      });
      it("returns formatted CSON", function() {
        expect(CSON.stringify({
          a: ['b']
        })).toBe('a: [\n  "b"\n]');
        expect(CSON.stringify({
          a: ['b', 4]
        })).toBe('a: [\n  "b"\n  4\n]');
      });
      describe("when the array has an undefined value", function() {
        it("formats the undefined value as null", function() {
          expect(CSON.stringify(['a', undefined, 'b'])).toBe('[\n  "a"\n  null\n  "b"\n]');
        });
      });
      describe("when the array contains an object", function() {
        it("wraps the object in {}", function() {
          expect(CSON.stringify([
            {
              a: 'b',
              a1: 'b1'
            }, {
              c: 'd'
            }
          ])).toBe('[\n  {\n    a: "b"\n    a1: "b1"\n  }\n  {\n    c: "d"\n  }\n]');
        });
      });
    });
    describe("when formatting an object", function() {
      describe("when the object is empty", function() {
        it("returns {}", function() {
          expect(CSON.stringify({})).toBe("{}");
        });
      });
      it("returns formatted CSON", function() {
        expect(CSON.stringify({
          a: {
            b: 'c'
          }
        })).toBe('a:\n  b: "c"');
        expect(CSON.stringify({
          a: {}
        })).toBe('a: {}');
        expect(CSON.stringify({
          a: []
        })).toBe('a: []');
      });
      it("escapes object keys", function() {
        expect(CSON.stringify({
          '\\t': 3
        })).toBe('"\\\\t": 3');
      });
    });
  });
  describe("when converting back to an object", function() {
    it("produces the original object", function() {
      var CSONParser, cson, evaledObject, object;
      object = {
        a: true,
        b: 20,
        c: {
          d: ['a', 'b']
        },
        e: {
          f: true
        }
      };
      cson = CSON.stringify(object);
      CSONParser = require('cson-parser');
      evaledObject = CSONParser.parse(cson);
      expect(evaledObject).toEqual(object);
    });
  });
  describe('.parse', function() {
    it('returns the javascript value', function() {
      expect(CSON.parse('a: "b"')).toEqual({
        a: 'b'
      });
    });
  });
  describe(".isObjectPath(objectPath)", function() {
    it("returns true if the path has an object extension", function() {
      expect(CSON.isObjectPath('/test2.json')).toBe(true);
      expect(CSON.isObjectPath('/a/b.cson')).toBe(true);
      expect(CSON.isObjectPath()).toBe(false);
      expect(CSON.isObjectPath(null)).toBe(false);
      expect(CSON.isObjectPath('')).toBe(false);
      expect(CSON.isObjectPath('a/b/c.txt')).toBe(false);
    });
  });
  describe(".resolve(objectPath)", function() {
    it("returns the path to the object file", function() {
      var file1, file2, file3, folder1, objectDir;
      objectDir = temp.mkdirSync('season-object-dir-');
      file1 = path.join(objectDir, 'file1.json');
      file2 = path.join(objectDir, 'file2.cson');
      file3 = path.join(objectDir, 'file3.json');
      folder1 = path.join(objectDir, 'folder1.json');
      fs.mkdirSync(folder1);
      fs.writeFileSync(file1, '{}');
      fs.writeFileSync(file2, '{}');
      fs.writeFileSync(file3, '{}');
      expect(CSON.resolve(file1)).toBe(file1);
      expect(CSON.resolve(file2)).toBe(file2);
      expect(CSON.resolve(file3)).toBe(file3);
      expect(CSON.resolve(path.join(objectDir, 'file4'))).toBe(null);
      expect(CSON.resolve(folder1)).toBe(null);
      expect(CSON.resolve()).toBe(null);
      expect(CSON.resolve(null)).toBe(null);
      expect(CSON.resolve('')).toBe(null);
    });
  });
  describe(".writeFile(objectPath, object, callback)", function() {
    var object;
    object = {
      a: 1,
      b: 2
    };
    describe("when called with a .json path", function() {
      it("writes the object and calls back", function() {
        var callback, jsonPath;
        jsonPath = path.join(temp.mkdirSync('season-object-dir-'), 'file1.json');
        callback = jasmine.createSpy('callback');
        CSON.writeFile(jsonPath, object, callback);
        waitsFor(function() {
          return callback.callCount === 1;
        });
        runs(function() {
          expect(CSON.readFileSync(jsonPath)).toEqual(object);
        });
      });
    });
    describe("when called with a .cson path", function() {
      var csonPath;
      csonPath = path.join(temp.mkdirSync('season-object-dir-'), 'file1.cson');
      return it("writes the object and calls back", function() {
        var callback;
        callback = jasmine.createSpy('callback');
        CSON.writeFile(csonPath, object, callback);
        waitsFor(function() {
          return callback.callCount === 1;
        });
        runs(function() {
          expect(CSON.readFileSync(csonPath)).toEqual(object);
        });
      });
    });
  });
  describe("caching", function() {
    describe("synchronous reads", function() {
      it("caches the contents of the compiled CSON files", function() {
        var CSONParser, cacheDir, samplePath;
        samplePath = path.join(__dirname, 'fixtures', 'sample.cson');
        cacheDir = temp.mkdirSync('cache-dir');
        CSON.setCacheDir(cacheDir);
        CSON.resetCacheStats();
        CSONParser = require('cson-parser');
        spyOn(CSONParser, 'parse').andCallThrough();
        expect(CSON.getCacheHits()).toBe(0);
        expect(CSON.getCacheMisses()).toBe(0);
        expect(CSON.readFileSync(samplePath)).toEqual({
          a: 1,
          b: {
            c: true
          }
        });
        expect(CSONParser.parse.callCount).toBe(1);
        expect(CSON.getCacheHits()).toBe(0);
        expect(CSON.getCacheMisses()).toBe(1);
        CSONParser.parse.reset();
        expect(CSON.readFileSync(samplePath)).toEqual({
          a: 1,
          b: {
            c: true
          }
        });
        expect(CSONParser.parse.callCount).toBe(0);
        expect(CSON.getCacheHits()).toBe(1);
        expect(CSON.getCacheMisses()).toBe(1);
      });
    });
    describe("asynchronous reads", function() {
      it("caches the contents of the compiled CSON files", function() {
        var CSONParser, cacheDir, sample, samplePath;
        samplePath = path.join(__dirname, 'fixtures', 'sample.cson');
        cacheDir = temp.mkdirSync('cache-dir');
        CSON.setCacheDir(cacheDir);
        CSON.resetCacheStats();
        CSONParser = require('cson-parser');
        spyOn(CSONParser, 'parse').andCallThrough();
        expect(CSON.getCacheHits()).toBe(0);
        expect(CSON.getCacheMisses()).toBe(0);
        sample = null;
        CSON.readFile(samplePath, function(error, object) {
          return sample = object;
        });
        waitsFor(function() {
          return sample != null;
        });
        runs(function() {
          expect(sample).toEqual({
            a: 1,
            b: {
              c: true
            }
          });
          expect(CSONParser.parse.callCount).toBe(1);
          expect(CSON.getCacheHits()).toBe(0);
          expect(CSON.getCacheMisses()).toBe(1);
          CSONParser.parse.reset();
          sample = null;
          return CSON.readFile(samplePath, function(error, object) {
            return sample = object;
          });
        });
        waitsFor(function() {
          return sample != null;
        });
        runs(function() {
          expect(CSONParser.parse.callCount).toBe(0);
          expect(CSON.getCacheHits()).toBe(1);
          expect(CSON.getCacheMisses()).toBe(1);
        });
      });
    });
  });
  describe("readFileSync", function() {
    it("returns null for files that are all whitespace", function() {
      expect(CSON.readFileSync(path.join(__dirname, 'fixtures', 'empty.cson'))).toBeNull();
      expect(CSON.readFileSync(path.join(__dirname, 'fixtures', 'empty.json'))).toBeNull();
      expect(CSON.readFileSync(path.join(__dirname, 'fixtures', 'empty-line.cson'))).toBeNull();
      expect(CSON.readFileSync(path.join(__dirname, 'fixtures', 'empty-line.json'))).toBeNull();
    });
    it("throws errors for invalid .cson files", function() {
      var error, errorPath, parseError;
      errorPath = path.join(__dirname, 'fixtures', 'syntax-error.cson');
      parseError = null;
      try {
        CSON.readFileSync(errorPath);
      } catch (_error) {
        error = _error;
        parseError = error;
      }
      expect(parseError.path).toBe(errorPath);
      expect(parseError.filename).toBe(errorPath);
      expect(parseError.location.first_line).toBe(0);
      expect(parseError.location.first_column).toBe(3);
    });
    it("throws errors for invalid .json files", function() {
      var error, errorPath, parseError;
      errorPath = path.join(__dirname, 'fixtures', 'syntax-error.json');
      parseError = null;
      try {
        CSON.readFileSync(errorPath);
      } catch (_error) {
        error = _error;
        parseError = error;
      }
      expect(parseError.path).toBe(errorPath);
      expect(parseError.filename).toBe(errorPath);
    });
    it("does not increment the cache stats when .json files are read", function() {
      expect(CSON.getCacheHits()).toBe(0);
      expect(CSON.getCacheMisses()).toBe(0);
      CSON.readFileSync(path.join(__dirname, 'fixtures', 'sample.json'));
      expect(CSON.getCacheHits()).toBe(0);
      expect(CSON.getCacheMisses()).toBe(0);
    });
    describe("when the allowDuplicateKeys option is set to false", function() {
      it("throws errors if objects contain duplicate keys", function() {
        expect(function() {
          return CSON.readFileSync(path.join(__dirname, 'fixtures', 'duplicate-keys.cson'), {
            allowDuplicateKeys: false
          });
        }).toThrow("Duplicate key 'foo'");
        expect(CSON.readFileSync(path.join(__dirname, 'fixtures', 'sample.cson'), {
          allowDuplicateKeys: false
        })).toEqual({
          a: 1,
          b: {
            c: true
          }
        });
        expect(CSON.readFileSync(path.join(__dirname, 'fixtures', 'duplicate-keys.cson'))).toEqual({
          foo: 3,
          bar: 2
        });
      });
    });
  });
  describe("readFile", function() {
    it("calls back with null for files that are all whitespace", function() {
      var callback;
      callback = function(error, content) {
        expect(error).toBeNull();
        expect(content).toBeNull();
      };
      readFile(path.join(__dirname, 'fixtures', 'empty.cson'), callback);
      readFile(path.join(__dirname, 'fixtures', 'empty.json'), callback);
      readFile(path.join(__dirname, 'fixtures', 'empty-line.cson'), callback);
      readFile(path.join(__dirname, 'fixtures', 'empty-line.json'), callback);
    });
    it("calls back with an error for files that do no exist", function() {
      var callback;
      callback = function(error, content) {
        expect(error).not.toBeNull();
        expect(content).toBeUndefined();
      };
      readFile(path.join(__dirname, 'fixtures', 'this-file-does-not-exist.cson'), callback);
      readFile(path.join(__dirname, 'fixtures', 'this-file-does-not-exist.json'), callback);
    });
    it("calls back with null for files that are all comments", function() {
      var callback;
      callback = function(error, content) {
        expect(error).toBeNull();
        return expect(content).toBeNull();
      };
      readFile(path.join(__dirname, 'fixtures', 'single-comment.cson'), callback);
      readFile(path.join(__dirname, 'fixtures', 'multi-comment.cson'), callback);
    });
    it("calls back with an error for invalid files", function() {
      var callback, done;
      done = false;
      callback = function(error, content) {
        done = true;
        expect(error).not.toBeNull();
        expect(error.path).toEqual(path.join(__dirname, 'fixtures', 'invalid.cson'));
        expect(error.message).toContain(path.join(__dirname, 'fixtures', 'invalid.cson'));
        expect(content).toBeUndefined();
      };
      readFile(path.join(__dirname, 'fixtures', 'invalid.cson'), callback);
      waitsFor(function() {
        return done;
      });
    });
    it("calls back with location information for .cson files with syntax errors", function() {
      var callback, done, errorPath;
      done = false;
      errorPath = path.join(__dirname, 'fixtures', 'syntax-error.cson');
      callback = function(parseError, content) {
        done = true;
        expect(parseError.path).toBe(errorPath);
        expect(parseError.filename).toBe(errorPath);
        expect(parseError.location.first_line).toBe(0);
        expect(parseError.location.first_column).toBe(3);
      };
      readFile(errorPath, callback);
      waitsFor(function() {
        return done;
      });
    });
    it("calls back with path information for .json files with syntax errors", function() {
      var callback, done, errorPath;
      done = false;
      errorPath = path.join(__dirname, 'fixtures', 'syntax-error.json');
      callback = function(parseError, content) {
        done = true;
        expect(parseError.path).toBe(errorPath);
        expect(parseError.filename).toBe(errorPath);
      };
      readFile(errorPath, callback);
      waitsFor(function() {
        return done;
      });
    });
    describe("when the allowDuplicateKeys option is set to false", function() {
      it("calls back with an error if objects contain duplicate keys", function() {
        var done, fixturePath;
        fixturePath = path.join(__dirname, 'fixtures', 'duplicate-keys.cson');
        done = false;
        runs(function() {
          return CSON.readFile(fixturePath, {
            allowDuplicateKeys: false
          }, function(err, content) {
            expect(err.message).toContain("Duplicate key 'foo'");
            expect(content).toBeUndefined();
            return done = true;
          });
        });
        waitsFor(function() {
          return done;
        });
        runs(function() {
          done = false;
          return CSON.readFile(fixturePath, function(err, content) {
            expect(content).toEqual({
              foo: 3,
              bar: 2
            });
            return done = true;
          });
        });
        waitsFor(function() {
          return done;
        });
      });
    });
    describe("when an error is thrown by the callback", function() {
      var uncaughtListeners;
      uncaughtListeners = null;
      beforeEach(function() {
        uncaughtListeners = process.listeners('uncaughtException');
        process.removeAllListeners('uncaughtException');
      });
      afterEach(function() {
        var listener, _i, _len, _results;
        _results = [];
        for (_i = 0, _len = uncaughtListeners.length; _i < _len; _i++) {
          listener = uncaughtListeners[_i];
          _results.push(process.on('uncaughtException', listener));
        }
        return _results;
      });
      it("only calls the callback once when it throws an error", function() {
        var callback, called, uncaughtHandler;
        called = 0;
        callback = function() {
          called++;
          throw new Error('called');
        };
        uncaughtHandler = jasmine.createSpy('uncaughtHandler');
        process.once('uncaughtException', uncaughtHandler);
        CSON.readFile(path.join(__dirname, 'fixtures', 'sample.cson'), callback);
        waitsFor(function() {
          return called > 0;
        });
        runs(function() {
          expect(called).toBe(1);
          expect(uncaughtHandler.callCount).toBe(1);
        });
      });
    });
  });
  describe("when options are provided for the underlying fs call", function() {
    it("passes options to the readFileSync call", function() {
      spyOn(fs, 'readFileSync').andReturn("{}");
      spyOn(parser, 'parse').andCallThrough();
      CSON.readFileSync("/foo/blarg.cson", {
        encoding: 'cuneiform',
        allowDuplicateKeys: false
      });
      expect(fs.readFileSync).toHaveBeenCalledWith("/foo/blarg.cson", {
        encoding: 'cuneiform'
      });
      expect(parser.parse.calls[0].args[0]).toEqual("{}");
      expect(typeof parser.parse.calls[0].args[1]).toEqual("function");
    });
    it("passes options to the readFile call", function() {
      var callback, called, cb;
      called = 0;
      callback = function() {
        return called++;
      };
      spyOn(parser, 'parse').andCallThrough();
      spyOn(fs, 'readFile').andCallFake(function(filePath, fsOptions, callback) {
        expect(filePath).toEqual("/bar/blarg.cson");
        expect(fsOptions).toEqual({
          encoding: 'cuneiform'
        });
        return callback(null, "{}");
      });
      cb = jasmine.createSpy('callback');
      CSON.readFile("/bar/blarg.cson", {
        encoding: 'cuneiform',
        allowDuplicateKeys: false
      }, cb);
      expect(fs.readFile).toHaveBeenCalled();
      expect(parser.parse.calls[0].args[0]).toEqual("{}");
      expect(typeof parser.parse.calls[0].args[1]).toEqual("function");
      expect(cb).toHaveBeenCalledWith(null, {});
    });
    it("passes options to the writeFileSync call", function() {
      spyOn(fs, 'writeFileSync').andCallFake(function(filePath, payload, fileOptions) {
        expect(filePath).toEqual("/stuff/wat.cson");
        expect(fileOptions).toEqual({
          mode: 0x1ed
        });
      });
      CSON.writeFileSync("/stuff/wat.cson", {
        data: 'yep'
      }, {
        mode: 0x1ed
      });
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(fs.writeFileSync.calls[0].args[2]).toEqual({
        mode: 0x1ed
      });
    });
    it("passes options to the writeFile call", function() {
      var cb;
      spyOn(fs, 'writeFile').andCallFake(function(filePath, payload, fileOptions, callback) {
        expect(filePath).toEqual("/eh/stuff.cson");
        expect(fileOptions).toEqual({
          flag: 'x'
        });
        return callback(null);
      });
      cb = jasmine.createSpy('callback');
      CSON.writeFile("/eh/stuff.cson", {}, {
        flag: 'x'
      }, cb);
      expect(fs.writeFile).toHaveBeenCalled();
      expect(cb).toHaveBeenCalledWith(null);
    });
  });
});
