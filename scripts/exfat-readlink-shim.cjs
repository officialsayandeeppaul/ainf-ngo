/**
 * Repairs `fs.readlink` error semantics on exFAT volumes.
 *
 * When a regular file is passed to readlink(), every mainstream filesystem
 * reports EINVAL — "this is not a symbolic link". On exFAT under Windows, Node
 * reports EISDIR instead. Symlink-resolving resolvers (webpack's
 * enhanced-resolve, and Next's own module graph) special-case EINVAL as the
 * ordinary "not a link" outcome and treat anything else as a real I/O failure,
 * so on an exFAT checkout the very first source file aborts the build:
 *
 *   Error: EISDIR: illegal operation on a directory, readlink '...\route.ts'
 *
 * Translating that one error code back to EINVAL restores the contract every
 * caller already expects. Nothing else about readlink changes: genuine symlinks
 * still resolve, and real directories passed to readlink still fail (a
 * directory is also "not a symlink", so EINVAL is the correct answer there too).
 *
 * The patch installs itself only when it detects the misbehaviour, so this file
 * is inert on NTFS, ext4, APFS, and CI. It is required from next.config.js,
 * which Next loads into the build process and every build worker before any
 * compilation starts.
 */

const fs = require("node:fs");

/**
 * A file that is guaranteed to exist and guaranteed not to be a symlink: this
 * module. readlink on it must fail; we only care about which code comes back.
 */
function detectBrokenReadlink() {
  try {
    fs.readlinkSync(__filename);
    return false;
  } catch (error) {
    return error && error.code === "EISDIR";
  }
}

function notALink(target) {
  const error = new Error(`EINVAL: invalid argument, readlink '${target}'`);
  error.code = "EINVAL";
  error.errno = -4071; // libuv's EINVAL on Windows
  error.syscall = "readlink";
  error.path = target;
  return error;
}

const isBroken = (error) => error && error.code === "EISDIR" && error.syscall === "readlink";

function install() {
  const { readlinkSync, readlink } = fs;

  fs.readlinkSync = function patchedReadlinkSync(target, options) {
    try {
      return readlinkSync.call(fs, target, options);
    } catch (error) {
      throw isBroken(error) ? notALink(target) : error;
    }
  };

  fs.readlink = function patchedReadlink(target, options, callback) {
    const done = typeof options === "function" ? options : callback;
    const translate = (error, result) =>
      done(isBroken(error) ? notALink(target) : error, result);
    return typeof options === "function"
      ? readlink.call(fs, target, translate)
      : readlink.call(fs, target, options, translate);
  };

  if (fs.promises && typeof fs.promises.readlink === "function") {
    const promisedReadlink = fs.promises.readlink.bind(fs.promises);
    fs.promises.readlink = (target, options) =>
      promisedReadlink(target, options).catch((error) => {
        throw isBroken(error) ? notALink(target) : error;
      });
  }
}

if (detectBrokenReadlink()) {
  install();
  if (!process.env.EXFAT_SHIM_QUIET) {
    console.log("- exFAT readlink shim active (EISDIR -> EINVAL)");
  }
}
