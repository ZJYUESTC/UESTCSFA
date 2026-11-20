/* 原创 SVG 图形：轮廓用于快速辨认，较大的舰船图用于查看装备与身份。 */
window.FleetArt = (() => {
  const shapes={
    destroyer:'M177 14L188 42L190 102L213 57L220 42L218 133L184 156L165 148L143 130L143 49L152 63L168 105Z',
    battleship:'M180 15L213 45L230 85L250 98L244 143L214 149L180 161L145 149L116 140L110 98L131 84L147 46Z',
    frigate:'M180 19L200 57L205 88L240 132L238 148L202 136L192 156L168 156L158 136L122 148L120 132L155 88L160 57Z',
    scout:'M180 12L193 71L201 104L225 142L203 134L189 149L171 149L157 134L135 142L159 104L167 71Z',
    cruiser:'M180 18L203 48L212 76L248 85L256 127L246 151L214 144L198 160L162 160L146 144L114 151L104 127L112 85L148 76L157 48Z',
    tender:'M180 25C204 25 208 49 208 68L235 80L242 136L224 151L197 142L193 158L167 158L163 142L136 151L118 136L125 80L152 68C152 49 156 25 180 25Z'
  };
  const glyphs={
    fleet:'M12 2L17 13L22 20L12 16L2 20L7 13ZM12 6V16',
    system:'M12 1V5M12 19V23M1 12H5M19 12H23M4 4L7 7M17 17L20 20M20 4L17 7M7 17L4 20M12 7A5 5 0 1 0 12 17A5 5 0 1 0 12 7',
    log:'M6 3H19V21H6ZM9 7H16M9 11H16M9 15H14M3 6H6M3 12H6M3 18H6',
    help:'M12 22A10 10 0 1 0 12 2A10 10 0 1 0 12 22M9 8C9 4 17 4 16 9C16 12 12 11 12 15M12 18V19',
    menu:'M3 6H21M3 12H21M3 18H21',
    move:'M3 12H20M14 5L21 12L14 19M2 6H7M2 18H7',
    attack:'M4 20L20 4M13 4H20V11M3 3L8 8M16 16L21 21M12 5L5 12M19 12L12 19',
    shield:'M12 2L21 6V13C20 17 16 20 12 22C8 20 4 17 3 13V6ZM12 7V17',
    repair:'M8 3V8H3V16H8V21H16V16H21V8H16V3Z',
    warp:'M3 17C7 4 17 4 21 17M3 12C9 0 15 0 21 12M12 8V22M8 18L12 22L16 18',
    hyper:'M4 5L10 12L4 19M11 5L17 12L11 19M20 5V19',
    focus:'M2 8V2H8M16 2H22V8M22 16V22H16M8 22H2V16M12 7A5 5 0 1 0 12 17A5 5 0 1 0 12 7',
    close:'M5 5L19 19M19 5L5 19',
    eye:'M1 12C6 3 18 3 23 12C18 21 6 21 1 12ZM12 8A4 4 0 1 0 12 16A4 4 0 1 0 12 8'
  };
  const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${glyphs[name]||glyphs.fleet}" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  function ship(kind,full=true){
    if(kind==='station'||kind==='battery'){
      const hull=kind==='station'?'M110 90l35-30h70l35 30-35 30h-70z M180 28v124 M150 50v81 M210 50v81':'M125 110l18-45h74l18 45-21 18h-68z M153 74V40 M165 74V40 M199 74V40 M211 74V40';
      return `<svg class="${full?'ship-portrait':'ship-mini'}" viewBox="${full?'0 0 360 180':'100 20 160 140'}" aria-hidden="true"><g stroke="currentColor" stroke-width="6" fill="#243c41"><path d="${hull}"/><circle cx="180" cy="90" r="15" fill="#baaa7a"/></g></svg>`;
    }
    const shape=shapes[kind]||shapes.frigate;
    if(!full)return `<svg class="ship-mini" viewBox="95 8 170 158" aria-hidden="true"><path d="${shape}" fill="currentColor" opacity=".8"/><path d="M180 35V142M166 95L180 78L194 95M166 125H194" fill="none" stroke="#0d1d23" stroke-width="4"/></svg>`;
    const tanks=kind==='tender'?'<g fill="#788f8e" stroke="#d5ccb1"><rect x="130" y="87" width="21" height="51" rx="9"/><rect x="209" y="87" width="21" height="51" rx="9"/><path d="M132 99H149M132 125H149M211 99H228M211 125H228"/></g>':'';
    const turrets=kind==='cruiser'?'<g fill="#c4c4ac" stroke="#263d42"><path d="M119 96H141V130H119ZM219 96H241V130H219Z"/><path d="M130 103V68M230 103V68" stroke="#a8b5ad" stroke-width="5"/><circle cx="130" cy="110" r="8"/><circle cx="230" cy="110" r="8"/></g>':'';
    return `<svg class="ship-portrait" viewBox="0 0 360 180" role="img" aria-label="${({frigate:'护卫舰',scout:'侦察舰',cruiser:'巡洋舰',tender:'支援舰'})[kind]}舰体示意"><defs><linearGradient id="hull-${kind}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#92a5a3"/><stop offset=".48" stop-color="#435e66"/><stop offset=".51" stop-color="#aeb9af"/><stop offset="1" stop-color="#293f49"/></linearGradient></defs><g fill="none" stroke="#b6a27b" opacity=".21"><circle cx="180" cy="91" r="76"/><circle cx="180" cy="91" r="65" stroke-dasharray="1 7"/><path d="M50 91H310M180 2V178M92 23L104 35M256 147L268 159M92 159L104 147M256 35L268 23"/></g><g fill="#72b8ba" opacity=".45"><path d="M164 151L170 176L176 151ZM184 151L190 176L196 151Z"/></g><path d="${shape}" fill="url(#hull-${kind})" stroke="#c5c5af" stroke-width="1.2"/><path d="M180 28L188 65L192 122L180 145L168 122L172 65Z" fill="#243e46" stroke="#9caeaa"/><path d="M180 31V142M168 81H192M168 96H192M170 114H190M155 93L144 127L166 120M205 93L216 127L194 120" fill="none" stroke="#d5c6a3" stroke-width=".8"/><path d="M174 64L180 48L186 64L184 77H176Z" fill="#b0d7cf"/><path d="M166 139H176V157H166ZM184 139H194V157H184Z" fill="#172f37" stroke="#7f9d9c"/>${tanks}${turrets}<g fill="none" stroke="#bcae90" opacity=".5"><path d="M158 55H97L81 39H39M211 123H271L288 139H324"/><circle cx="158" cy="55" r="2"/><circle cx="211" cy="123" r="2"/></g><text x="39" y="33" fill="#8d9c98" font-size="7" letter-spacing="2">HULL / ${kind.toUpperCase()}</text><text x="287" y="151" fill="#8d9c98" font-size="7" letter-spacing="1">DRIVE ARRAY</text></svg>`;
  }
  return {icon,ship};
})();
