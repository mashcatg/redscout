// Spintax resolver: supports nested {a|b|{c|d}} with arbitrary depth.
export function resolveSpintax(template: string, rand: () => number = Math.random): string {
  let s = template;
  // Repeatedly resolve innermost {...|...} blocks until none remain.
  const re = /\{([^{}]+)\}/;
  let safety = 0;
  while (re.test(s) && safety++ < 5000) {
    s = s.replace(re, (_m, inner: string) => {
      const options = inner.split("|");
      const pick = options[Math.floor(rand() * options.length)];
      return pick;
    });
  }
  return s;
}

// Count how many distinct variants the template can produce.
export function countVariants(template: string): number {
  let s = template;
  let total = 1;
  const re = /\{([^{}]+)\}/;
  let safety = 0;
  while (re.test(s) && safety++ < 5000) {
    s = s.replace(re, (_m, inner: string) => {
      const parts = inner.split("|");
      total *= parts.length;
      return parts[0];
    });
  }
  return total;
}
