const axios = require("axios");
const invariant = require("invariant");
const fs = require("fs");
const path = require("path");
const {
  findCryptoCurrencyByTicker,
  findFiatCurrencyByTicker
} = require("../../lib/currencies");

const importers = [require("./importers/erc20")];

const outputFolder = path.join(__dirname, "../../src/load");
const inputFolder = process.argv[2];
if (!inputFolder) {
  console.error(
    "The folder of ledger's crypto-assets is required in parameter"
  );
  process.exit(1);
}

const WARN_IF_COUNTERVALUES = true;

axios
  .get("https://countervalues.api.live.ledger.com/tickers")
  .then(({ data: countervaluesTickers }) => {
    importers.forEach(imp => {
      const folder = path.join(inputFolder, imp.path);
      const output = path.join(outputFolder, imp.path + ".js");
      const items = fs.readdirSync(folder);
      Promise.all(items.sort().map(id => imp.loader({ folder, id })))
        .then(all => all.filter(Boolean))
        .then(all => {
          const fiatCollisions = all.filter(
            a =>
              findFiatCurrencyByTicker(a[2]) &&
              !a[7] &&
              (WARN_IF_COUNTERVALUES
                ? countervaluesTickers.includes(a[2])
                : true)
          );
          const cryptoCollisions = all.filter(
            a =>
              findCryptoCurrencyByTicker(a[2]) &&
              !a[7] &&
              (WARN_IF_COUNTERVALUES
                ? countervaluesTickers.includes(a[2])
                : true)
          );
          const groups = {};
          all.forEach(a => {
            if (a[7]) return;
            groups[a[2]] = (groups[a[2]] || []).concat([a]);
          });
          const dupTickers = Object.keys(groups).filter(
            a =>
              groups[a].length > 1 &&
              (WARN_IF_COUNTERVALUES ? countervaluesTickers.includes(a) : true)
          );

          if (fiatCollisions.length > 0) {
            console.warn("\nERC20 THAT COLLIDES WITH FIAT TICKERS:\n");
            fiatCollisions.forEach(t => {
              console.warn(t[2] + " ticker used by erc20: " + t[1]);
            });
          }

          if (cryptoCollisions.length > 0) {
            console.warn(
              "\nERC20 THAT COLLIDES WITH OTHER CRYPTO ASSETS TICKERS:\n"
            );
            cryptoCollisions.forEach(t => {
              console.warn(t[2] + " ticker used by erc20: " + t[1]);
            });
          }

          if (dupTickers.length > 0) {
            console.warn("\nERC20 TICKER COLLISIONS:\n");
            dupTickers.forEach(ticker => {
              console.warn(
                ticker +
                  " ticker is used by erc20: " +
                  groups[ticker].map(a => a[1]).join(", ")
              );
            });
          }

          return all;
        })
        .then(all =>
          fs.writeFileSync(output, imp.outputTemplate(all), "utf-8")
        );
    });
  });
