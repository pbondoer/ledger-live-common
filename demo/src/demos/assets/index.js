// @flow
import React, { Component, useEffect, useState, useMemo } from "react";
import ReactTable from "react-table";
import { BigNumber } from "bignumber.js";
import uniqWith from "lodash/uniqWith";
import {
  listTokens,
  listCryptoCurrencies,
  isCurrencySupported,
  getCryptoCurrencyById,
  getFiatCurrencyByTicker,
  useCurrenciesByMarketcap,
  useMarketcapTickers,
  formatCurrencyUnit
} from "@ledgerhq/live-common/lib/currencies";
import {
  getDailyRatesBatched,
  formatCounterValueDay
} from "@ledgerhq/live-common/lib/countervalues";

const usdFiat = getFiatCurrencyByTicker("USD");
const bitcoin = getCryptoCurrencyById("bitcoin");
const ethereum = getCryptoCurrencyById("ethereum");

const getRates = getDailyRatesBatched(50);

const columns = [
  {
    Header: "Live?",
    width: 80,
    accessor: "livesupport"
  },
  {
    Header: "type",
    width: 120,
    accessor: "typeText"
  },
  {
    Header: "Name",
    accessor: "name"
  },
  {
    Header: "Ticker",
    accessor: "ticker",
    width: 100
  },
  {
    Header: "extra",
    id: "extra",
    accessor: token =>
      token.type === "TokenCurrency" ? (
        <a
          target="_blank"
          rel="noopener noreferrer"
          href={`https://etherscan.io/address/${token.contractAddress}`}
        >
          {token.contractAddress}
        </a>
      ) : (
        "coinType=" + token.coinType
      )
  },
  {
    id: "countervalue",
    Header: p => {
      const data = p.data.map(d => d._original);
      const supported = data.filter(d => d.countervalueStatus === "yes");
      const withExchange = data.filter(d => d.exchange);
      const percentageSupport = supported.length / data.length;
      const realPercentageSupport = withExchange.length / data.length;
      return (
        <div>
          <strong>countervalue</strong>
          <div>
            {supported.length} have marketcap (
            {Math.floor(percentageSupport * 1000) / 10}%)
          </div>
          <div>
            {withExchange.length} supported (
            {Math.floor(realPercentageSupport * 1000) / 10}%)
          </div>
        </div>
      );
    },
    accessor: "countervalueText"
  }
];

const counterpartFor = c =>
  c === bitcoin ? usdFiat : c.type === "CryptoCurrency" ? bitcoin : ethereum;

const Assets = () => {
  const tokens = listTokens();
  const currencies = listCryptoCurrencies();
  const all = useMemo(() => currencies.concat(tokens), [tokens, currencies]);
  const tickers = useMarketcapTickers() || [];
  const [rates, setRates] = useState({});
  const byMarketcap = useCurrenciesByMarketcap(all);
  const data = byMarketcap.map(t => {
    let countervalueStatus = "no";
    let loading = false;
    let exchange;
    let formatted = "";
    if (t.disableCountervalue) {
      countervalueStatus = "disabled";
    } else if (tickers.includes(t.ticker)) {
      countervalueStatus = "yes";
      const counter = counterpartFor(t);
      if (rates[counter.ticker]) {
        const ratePerExchange = (rates[counter.ticker] || {})[t.ticker] || {};
        exchange = Object.keys(ratePerExchange)[0];
        if (exchange) {
          const latest = ratePerExchange[exchange].latest || 0;
          formatted = formatCurrencyUnit(
            counter.units[0],
            BigNumber(latest).times(10 ** t.units[0].magnitude),
            {
              showCode: true
            }
          );
        }
      } else {
        loading = true;
      }
    }
    const countervalueText =
      countervalueStatus !== "yes"
        ? countervalueStatus
        : loading
        ? "..."
        : exchange
        ? exchange + " @ " + formatted
        : "no exchange found";
    const livesupport =
      t.type === "TokenCurrency" || isCurrencySupported(t) ? "yes" : "no";
    return {
      ...t,
      typeText:
        t.type === "TokenCurrency"
          ? "token on " + t.parentCurrency.name
          : "coin",
      countervalueStatus,
      countervalueText,
      exchange,
      loading,
      livesupport
    };
  });

  useEffect(() => {
    if (!tickers) return;
    const afterDay = formatCounterValueDay(new Date());
    getRates(
      () => window.LEDGER_CV_API,
      uniqWith(
        all
          .filter(c => tickers.includes(c.ticker))
          .map(from => ({
            from: from.ticker,
            to: counterpartFor(from).ticker,
            afterDay
          })),
        (a, b) => a.from === b.from && a.to === b.to
      )
    ).then(setRates);
  }, [tickers, all]);

  return (
    <div
      style={{
        boxSizing: "border-box",
        height: "100vh",
        display: "flex"
      }}
    >
      <ReactTable
        style={{ flex: 1 }}
        showPagination={false}
        showPaginationBottom={false}
        defaultPageSize={-1}
        data={data}
        columns={columns}
        filterable
      />
    </div>
  );
};

export default class Demo extends Component<{}> {
  static demo = {
    title: "Assets",
    url: "/assets"
  };
  render() {
    return <Assets />;
  }
}
