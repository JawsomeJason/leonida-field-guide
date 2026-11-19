// Prints the smallest touch target per screen from the `smallest` annotations the touch tests leave.
export default class TouchReport {
  rows = [];
  onTestEnd(test) {
    for (const a of test.annotations) if (a.type === 'smallest') this.rows.push(`${test.parent.project().name.padEnd(12)} ${a.description}`);
  }
  onEnd() {
    console.log(`\nSmallest touch target per screen (CSS px):\n${this.rows.sort().join('\n')}`);
  }
}
