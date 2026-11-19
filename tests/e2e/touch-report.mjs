// Prints the smallest hit area per screen from the `smallest` annotations the touch tests leave: one line per screen and width,
// the worst of the states measured. Annotation text: "<path>|<state>|<WxH> <control>".
export default class TouchReport {
  worst = new Map();
  onTestEnd(test) {
    for (const a of test.annotations) {
      if (a.type !== 'smallest') continue;
      const [path, state, small] = a.description.split('|');
      const key = `${test.parent.project().name.padEnd(12)} ${path}`;
      const [w, h] = small.split(' ')[0].split('x').map(Number);
      const size = Math.min(w, h);
      if (!this.worst.has(key) || size < this.worst.get(key).size) this.worst.set(key, { size, text: `${small}  (${state})` });
    }
  }
  onEnd() {
    const rows = [...this.worst].map(([k, v]) => `${k.padEnd(36)} ${v.text}`).sort();
    console.log(`\nSmallest hit area per screen and width (CSS px):\n${rows.join('\n')}`);
  }
}
