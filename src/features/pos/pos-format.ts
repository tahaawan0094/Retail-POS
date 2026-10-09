export const formatPosMoney = (paisa:number) => `Rs ${(paisa/100).toLocaleString('en-PK',{ maximumFractionDigits:2 })}`
