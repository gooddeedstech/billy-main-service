export interface BankPattern {
  bankCode: string;   // NIP / Rubies bank code
  name: string;       // Bank name
  aliases: string[];  // names users type
  prefixes: string[]; // inferred from real-world usage
  lengths: number[];  // 10 or 9 depending on microfinance
}

/**
 * BANK_PATTERNS — curated for Rubies API transfers
 * Bank codes sourced from Rubies / NIP / CBN
 */
export const BANK_PATTERNS: BankPattern[] = [
  // =====================
  //  COMMERCIAL BANKS
  // =====================

  {
    bankCode: "000014",
    name: "ACCESS BANK",
    aliases: ["access", "accessbank", "access bank", "accesscorp"],
    prefixes: ["07", "08", "00"],
    lengths: [10],
  },
  {
    bankCode: "100013",
    name: "ACCESS MOBILE",
    aliases: ["access mobile", "accessmobile"],
    prefixes: ["07"],
    lengths: [10],
  },
  {
    bankCode: "000013",
    name: "GTBANK",
    aliases: ["gtb", "gtbank", "gt bank", "guaranty trust", "guaranty trust bank"],
    prefixes: ["01", "02", "05"],
    lengths: [10],
  },
  {
    bankCode: "000016",
    name: "FIRST BANK",
    aliases: ["firstbank", "first bank", "fbn", "first bank nigeria"],
    prefixes: ["30", "31"],
    lengths: [10],
  },
  {
    bankCode: "000015",
    name: "ZENITH BANK",
    aliases: ["zenith", "zenithbank", "zenith bank"],
    prefixes: ["20", "21"],
    lengths: [10],
  },
  {
    bankCode: "033",
    name: "UBA",
    aliases: ["uba", "united bank for africa"],
    prefixes: ["10", "11"],
    lengths: [10],
  },
  {
    bankCode: "070",
    name: "FIDELITY BANK",
    aliases: ["fidelity", "fidelity bank"],
    prefixes: ["40", "41"],
    lengths: [10],
  },
  {
    bankCode: "214",
    name: "FCMB",
    aliases: ["fcmb", "first city", "first city monument", "first city monument bank"],
    prefixes: ["22", "23"],
    lengths: [10],
  },
  {
    bankCode: "050",
    name: "ECOBANK",
    aliases: ["ecobank", "eco bank"],
    prefixes: ["33", "34"],
    lengths: [10],
  },
  {
    bankCode: "032",
    name: "UNION BANK",
    aliases: ["union", "union bank", "unionbank"],
    prefixes: ["50"],
    lengths: [10],
  },
  {
    bankCode: "076",
    name: "POLARIS BANK",
    aliases: ["polaris", "polaris bank"],
    prefixes: ["90"],
    lengths: [10],
  },
  {
    bankCode: "082",
    name: "KEYSTONE BANK",
    aliases: ["keystone", "keystone bank"],
    prefixes: ["82"],
    lengths: [10],
  },
  {
    bankCode: "221",
    name: "STANBIC IBTC",
    aliases: ["stanbic", "stanbic ibtc", "ibtc"],
    prefixes: ["04"],
    lengths: [10],
  },
  {
    bankCode: "232",
    name: "STERLING BANK",
    aliases: ["sterling", "sterling bank"],
    prefixes: ["70"],
    lengths: [10],
  },
  {
    bankCode: "035",
    name: "WEMA BANK",
    aliases: ["wema", "wema bank"],
    prefixes: ["80"],
    lengths: [10],
  },
  {
    bankCode: "215",
    name: "UNITY BANK",
    aliases: ["unity", "unitybank", "unity bank"],
    prefixes: ["55"],
    lengths: [10],
  },
  {
    bankCode: "301",
    name: "JAIZ BANK",
    aliases: ["jaiz", "jaiz bank"],
    prefixes: ["60"],
    lengths: [10],
  },
  {
    bankCode: "103",
    name: "GLOBUS BANK",
    aliases: ["globus", "globus bank"],
    prefixes: ["98"],
    lengths: [10],
  },
  {
    bankCode: "030",
    name: "HERITAGE BANK",
    aliases: ["heritage", "heritage bank"],
    prefixes: ["35"],
    lengths: [10],
  },
  {
    bankCode: "100",
    name: "SUNTRUST BANK",
    aliases: ["suntrust", "sun trust", "suntrust bank"],
    prefixes: ["61"],
    lengths: [10],
  },
  {
    bankCode: "101",
    name: "PROVIDUS BANK",
    aliases: ["providus", "providus bank"],
    prefixes: ["65"],
    lengths: [10],
  },
  {
    bankCode: "102",
    name: "TITAN TRUST BANK",
    aliases: ["titan", "titan trust", "titan trust bank"],
    prefixes: ["45"],
    lengths: [10],
  },

  // =============================
  //   PAYMENT SERVICE BANKS (PSB)
  // =============================
  {
    bankCode: "120001",
    name: "9PSB",
    aliases: ["9psb", "nine psb", "9 payment service bank"],
    prefixes: ["90"],
    lengths: [10],
  },
  {
    bankCode: "120002",
    name: "HOPE PSB",
    aliases: ["hope psb", "hope bank"],
    prefixes: ["91"],
    lengths: [10],
  },
  {
    bankCode: "120003",
    name: "MONEYMASTER PSB",
    aliases: ["moneymaster", "money master"],
    prefixes: ["92"],
    lengths: [10],
  },

  // =============================
  //   MOBILE MONEY / FINTECH
  // =============================

  {
    bankCode: "999992",
    name: "OPAY (PAYCOM)",
    aliases: ["opay", "paycom", "opay bank"],
    prefixes: ["80","81","90","70","10", "11"],
    lengths: [10],
  },
  {
    bankCode: "100033",
    name: "PALMPAY",
    aliases: ["palmpay", "palm pay"],
    prefixes: ["80","81","90","70","12", "13"],
    lengths: [10],
  },
  {
    bankCode: "50211",
    name: "KUDA MFB",
    aliases: ["kuda", "kuda bank"],
    prefixes: ["08"],
    lengths: [10],
  },
  {
    bankCode: "50515",
    name: "MONIEPOINT MFB",
    aliases: ["moniepoint", "monie point", "teamapt"],
    prefixes: ["28"],
    lengths: [10],
  },
  {
    bankCode: "100031",
    name: "FLUTTERWAVE",
    aliases: ["flutterwave", "rave"],
    prefixes: ["27"],
    lengths: [10],
  },
  {
    bankCode: "100032",
    name: "PAYSTACK",
    aliases: ["paystack", "pay stack"],
    prefixes: ["26"],
    lengths: [10],
  },

  // =============================
  // MICROFINANCE BANKS (Rubies)
  // =============================

  {
    bankCode: "090134",
    name: "ACCION MFB",
    aliases: ["accion", "accion mfb"],
    prefixes: ["56"],
    lengths: [10],
  },
  {
    bankCode: "070010",
    name: "ABBEY MORTGAGE BANK",
    aliases: ["abbey", "abbey mfb", "abbey mortgage"],
    prefixes: ["07"],
    lengths: [10],
  },
  {
    bankCode: "50383",
    name: "HASAL MFB",
    aliases: ["hasal", "hasal mfb"],
    prefixes: ["58"],
    lengths: [10],
  },
  {
    bankCode: "566",
    name: "VFD MICROFINANCE BANK",
    aliases: ["vfd", "vbank", "v bank"],
    prefixes: ["59"],
    lengths: [10],
  },
  {
    bankCode: "51310",
    name: "SPARKLE MFB",
    aliases: ["sparkle", "sparkle bank"],
    prefixes: ["88"],
    lengths: [10],
  },
  {
    bankCode: "565",
    name: "CARBON MFB",
    aliases: ["carbon", "paylater"],
    prefixes: ["89"],
    lengths: [10],
  }
];