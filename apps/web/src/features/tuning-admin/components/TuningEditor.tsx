interface TuningEditorProps {
  token: string;
}

export function TuningEditor({token}: TuningEditorProps) {
  return <div data-testid="tuning-editor">Tuning editor ready (token {token ? 'set' : 'missing'})</div>;
}
