/**
 * Settings panel styles for the Grok Subscription section.
 *
 * Uses the host's own design tokens (`--dsw-alias-*`) and the same metrics as
 * DSH's built-in settings pages — cards are 16px radius on `bg-layer-3` with a
 * `.5px` `border-l4`, controls are 36px pills — so the panel matches the
 * surrounding Settings UI instead of looking bolted on.
 */
export const SETTINGS_STYLE = `
.grokSubscription{display:flex;flex-direction:column;gap:10px;max-width:720px;color:var(--dsw-alias-label-primary);container-type:inline-size}
.grokSubscription h2,.grokSubscription h3,.grokSubscription p{margin:0}
.grokSubscription h2{font-size:16px;line-height:24px;font-weight:500}
.grokSubscription h3{font-size:15px;line-height:22px;font-weight:600}

.gsHead{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.gsLead{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}

.gsCard{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:12px}
.gsCardHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.gsCardHead .gsSpacer{flex:1;min-width:0}

.gsChip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:2px 10px;font-size:12px;line-height:18px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.gsChip--ok{color:var(--dsw-alias-state-success-primary)}
.gsChip--off{color:var(--dsw-alias-label-tertiary)}
.gsChip--warn{color:var(--dsw-alias-state-warn-label)}
.gsChip--error{color:var(--dsw-alias-label-error)}
.gsDot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}

.gsAccount{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}

.gsActions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.gsBtn{box-sizing:border-box;height:36px;font:inherit;cursor:pointer;border:.5px solid var(--dsw-alias-border-l3);border-radius:18px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 14px;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);background:0 0;transition:background .16s,border-color .16s,color .16s}
.gsBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.gsBtn:focus-visible{outline:2px solid var(--dsw-alias-border-l3);outline-offset:2px}
.gsBtn:disabled{opacity:.45;cursor:not-allowed}
.gsBtn--primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border-color:transparent}
.gsBtn--primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.gsBtn--danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-label-error);border-color:var(--dsw-alias-label-error)}

.gsStatus{display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.gsStatus--ok{color:var(--dsw-alias-state-success-primary)}
.gsStatus--error{color:var(--dsw-alias-label-error)}
.gsStatus--warn{color:var(--dsw-alias-state-warn-label)}
.gsStatus--busy{color:var(--dsw-alias-label-tertiary)}

.gsDisclosure{margin:0}
.gsDisclosure>summary{display:flex;align-items:center;gap:8px;min-height:28px;cursor:pointer;list-style:none;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.gsDisclosure>summary::-webkit-details-marker{display:none}
.gsDisclosure>summary:hover{color:var(--dsw-alias-label-primary)}
.gsDisclosure>summary:focus-visible{outline:2px solid var(--dsw-alias-border-l3);outline-offset:4px;border-radius:4px}
.gsChevron{flex:none;transition:transform .16s}
.gsDisclosure[open] .gsChevron{transform:rotate(180deg)}
.gsDisclosureBody{display:flex;flex-direction:column;gap:6px;padding-top:8px;margin-top:8px;border-top:.5px solid var(--dsw-alias-border-l2)}
.gsDisclosureBody p{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}

.gsGauge{display:flex;flex-direction:column;gap:8px}
.gsGaugeTop{display:flex;align-items:baseline;gap:8px}
.gsGaugeValue{font-size:24px;line-height:30px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.gsGaugeLabel{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.gsBar{height:6px;border-radius:999px;background:color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent);overflow:hidden}
.gsBar>span{display:block;height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary);transition:width .2s}
.gsGaugeMeta{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.gsGaugeMeta code{font-size:11px;color:var(--dsw-alias-label-tertiary)}

.gsRows{display:flex;flex-direction:column;gap:0}
.gsRow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;font-size:13px;line-height:20px;border-top:.5px solid var(--dsw-alias-border-l2)}
.gsRow:first-child{border-top:none}
.gsRowValue{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}

.gsModels{display:flex;flex-wrap:wrap;gap:6px}
.gsModel{display:inline-flex;align-items:baseline;gap:6px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:4px 10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary)}
.gsModel code{font-size:11px;color:var(--dsw-alias-label-tertiary)}

.gsHint,.gsEmpty,.gsCaveat{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.gsCaveat{font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
.gsLink{color:var(--dsw-alias-link);font-size:13px;line-height:20px;text-decoration:none;align-self:center}
.gsLink:hover{text-decoration:underline}

@container (max-width: 420px){
  .grokSubscription .gsGaugeValue{font-size:20px;line-height:26px}
  .grokSubscription .gsBtn{flex:1 1 auto}
}
`
