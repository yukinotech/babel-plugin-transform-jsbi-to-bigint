import JSBD from "jsbd";

const a = JSBD.BigDecimal;

const one = JSBD.BigDecimal(1);

const one2 = JSBD.BigDecimal("0x32");

const one3 = JSBD.BigDecimal(1n);

const isBig = JSBD.lessThan(JSBD.BigDecimal("0x32"), JSBD.BigDecimal(1n));

const two = JSBD.add(one, one2, { maximumFractionDigits: 1 });

const two2 = JSBD.add(one, one2);

one instanceof JSBD; // JSBD has not implete yet
