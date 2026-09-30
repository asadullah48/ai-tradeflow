export const money = (value: number) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 2,
  }).format(value);
export const quantity = (value: number) =>
  new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(value);
// A trader's calendar date, rather than a UTC date that can be yesterday in Pakistan.
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
