/**
 * The amount field doubles as a calculator: "15+190" shows "= 205" and Tab puts 205 in its place.
 * Supports + − × ÷ (also * and /), brackets and decimals. No `eval`: a tiny parser.
 */

const OPERATOR = /[+\-−*/×÷()]/

/** Text with an operator after the first character (a leading sign alone is just a number). */
export const isExpression = (text: string) => OPERATOR.test(text.trim().slice(1)) || /[*/×÷()]/.test(text)

/** The result as plain digits ("205", "0.5"), or undefined while the expression is incomplete. */
export function evaluate(text: string): string | undefined {
  const tokens = text.replace(/\s/g, '').replace(/,/g, '.').match(/\d*\.?\d+|\d+\.|[+\-−*/×÷()]|./g) ?? []
  let i = 0
  const peek = () => tokens[i]

  // sum := product (("+" | "-") product)*
  const sum = (): number => {
    let value = product()
    while (peek() === '+' || peek() === '-' || peek() === '−') value = tokens[i++] === '+' ? value + product() : value - product()
    return value
  }
  // product := unary (("*" | "/") unary)*
  const product = (): number => {
    let value = unary()
    while (peek() === '*' || peek() === '×' || peek() === '/' || peek() === '÷') {
      const op = tokens[i++]
      value = op === '*' || op === '×' ? value * unary() : value / unary()
    }
    return value
  }
  // unary := "-" unary | "(" sum ")" | number
  const unary = (): number => {
    const token = tokens[i++]
    if (token === '-' || token === '−') return -unary()
    if (token === '+') return unary()
    if (token === '(') {
      const value = sum()
      if (tokens[i++] !== ')') return NaN
      return value
    }
    return token !== undefined && /^\d*\.?\d*$/.test(token) && token !== '.' ? Number(token) : NaN
  }

  const result = sum()
  if (i !== tokens.length || !Number.isFinite(result)) return undefined
  // Round away float noise (0.1 + 0.2), keep plain digits (no "1e+21").
  const rounded = Math.round(result * 1e8) / 1e8
  return rounded.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 8 })
}

/** What the amount field really holds: the result of an expression (only above zero), or the number as typed. */
export function resolveAmount(text: string) {
  if (!isExpression(text)) return text
  const result = evaluate(text)
  return result !== undefined && Number(result) > 0 ? result : ''
}
