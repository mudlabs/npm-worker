const github = require("@actions/github");

Array.prototype.drop = function(start, end = this.length - start) { 
  this.splice(start, end);
  return this; 
}

const splitAndFilter = (item) => (char) => (clause) => item.split(char).filter(value => value !== clause);

const condenseStderr = item => {
  const packageExp = new RegExp(`'(${item.package}(?:@.+)?)'`);
  const err_array = item.stderr.split("\n");
  const code = err_array[0];
  const stderr = err_array
    .drop(0,1)
    .filter(value => value !== "")
    .map(value => value.replace(/^npm ERR! (?:\d+)?/, "").trim())
    .map(value => value.replace(packageExp, "`$1`"))
    .join(" ");
  
  return item.shortMessage !== ""
    ? `${code}\n${item.shortMessage}\n${stderr}`
    : `${code}\n${stderr}`;
}

const markItemFailed = item => `- ![failed] \`${item.package}\`\n  > ${condenseStderr(item)}\n`;

const setInstalledItem = item => {
  if (item.failed) {
    return `- ![failed] \`${item.package}\`\n  > ${condenseStderr(item)}\n`;
  } else {
    return item.stdout.split("\n")
      .filter(value => value !== "")
      .drop(2,2)
      .map(value => value.startsWith("+ ") ? value.replace(/(\+ )(\S+)/, `- ![success] \`$2\``) : `  > ${value}`)
      .join("\n");
  }
}

const setUpdatedItem = item => {
  if (item.failed) {
    return `- ![failed] \`${item.package}\`\n  > ${condenseStderr(item)}\n`
  } else {
    return item.stdout.split("\n")
      .filter(value => value !== "")
      .drop(2,2)
      .map(value => value.startsWith("+ ") ? value.replace(/(\+ )(\S+)/, `- ![success] \`$2\``) : `  > ${value}`)
      .join("\n");
  }
};

const setUninstalledItem = item => {
  if (item.failed) {
    return `- ![failed] \`${item.package}\`\n  > ${condenseStderr(item)}\n`;
  } else {
    const stdout_array = item.stdout.split("\n").filter(value => value !== "").drop(1,2).map(value => `  > ${value}`);
    const just_passed = stdout_array[0].startsWith("  > audited");
    const package_state = `- ![${just_passed ? "passed" : "success"}] \`${item.package}\`\n`;
    if (just_passed) stdout_array.unshift(`  > Package does not seem to have been _installed_.`);
    return package_state + stdout_array.join("\n");
  }
};

const buildList = title => items => {
  if (items.length < 1) return "";
  const list = items.reduce((list, item) => {
    let listItem;
    switch (title) {
      case "Installed":
        listItem = setInstalledItem(item);
        break;
      case "Updated":
        listItem = setUpdatedItem(item);
        break;
      case "Uninstalled":
        listItem = setUninstalledItem(item);
        break;
    }
    return list += `${listItem}\n`;
  }, `### ${title}\n`) + `\n`;
  return list;
};

const buildDescription = (install, update, uninstall) => {
  const numberOfPackages = items => {
    const number = items.length;
    return `${number} package${number === 1 ? "" : "s"}`;
  }
  const tag = title => items => items.length > 0 ? `_${title}_ ${numberOfPackages(items)}` : "";

  const installed = tag("install")(install);
  const updated = tag("update")(update);
  const uninstalled = tag("uninstall")(uninstall);
  const opperations = ([installed, updated, uninstalled]
                       .filter(item => item !== "")
                       .map((item, index, array) => array.length > 1 && index === array.length - 1 ? `and ${item}` : item)
                      ).join(", ");

  return `An update to your configuration file requested [NPM Worker][marketplace] ${opperations}.\n`;
}

exports.buildActivityReport = function (install, update, uninstall) {
  const marketplace = "[marketplace]: https://github.com/marketplace/activity/npm-worker";
  const icon = "[icon]: https://github.com/mudlabs/npm-worker/raw/master/npm_worker_icon.png";
  const success = "[success]: https://via.placeholder.com/15/15f06e/000000?text=+";
  const failed = "[failed]: https://via.placeholder.com/15/f03c15/000000?text=+";
  const passed = "[passed]: https://via.placeholder.com/15/e6c620/000000?text=+";
  const sender = github.context.payload.sender;
  const requester = `Requested by [\`@${sender.login}\`](https://github.com/${sender.login})`;
  const commit = `Triggered by commit ${github.context.sha}`;
  const description = buildDescription(install, update, uninstall);
  const installed = buildList("Installed")(install)
  const updated = buildList("Updated")(update)
  const uninstalled = buildList("Uninstalled")(uninstall);
  const header = `> [![icon]][marketplace]\n> ${requester}\n> ${commit}\n`;
  const footer = `${marketplace}\n${icon}\n${success}\n${failed}\n${passed}`;
  
  
  return `${header}\n\n${description}\n${installed}\n${updated}\n${uninstalled}\n\n${footer}`

}
