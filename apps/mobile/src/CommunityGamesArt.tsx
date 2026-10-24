/** Original NAQLA launcher artwork. Upstream game artwork is NOT copied here. */
export function CommunityGamesArt({ game }: { game: 'supertux' | 'freecivWeb' | 'mindustry' }) {
  if (game === 'supertux') return (
    <svg viewBox="0 0 160 160" role="presentation">
      <defs><linearGradient id="st-sky" x2="0" y2="1"><stop stopColor="#46baff"/><stop offset="1" stopColor="#d2edfa"/></linearGradient></defs>
      <rect width="160" height="160" fill="url(#st-sky)"/>
      <path d="M0 120L28 70 43 93 78 38 123 105 145 75 160 94V160H0Z" fill="#f1fdff"/>
      <path d="M0 146Q25 115 53 140T108 133T160 131V160H0Z" fill="#2c98ae"/>
      <g transform="translate(77 100)"><ellipse cx="0" cy="22" rx="27" ry="10" fill="#113345" opacity=".4"/><ellipse rx="23" ry="28" fill="#20304c"/><ellipse cy="-17" rx="17" ry="15" fill="#263453"/><ellipse cy="5" rx="14" ry="18" fill="#fcfbef"/><circle cx="-8" cy="-20" r="3" fill="white"/><circle cx="8" cy="-20" r="3" fill="white"/><path d="M-8-12L0-6 8-12Z" fill="#ffb452"/><path d="M-18 21L-30 27M18 21L30 27" stroke="#f7a54a" strokeWidth="8" strokeLinecap="round"/></g>
      <circle cx="127" cy="29" r="13" fill="#ffeeab" opacity=".95"/>
    </svg>
  );
  if (game === 'freecivWeb') return (
    <svg viewBox="0 0 160 160" role="presentation">
      <defs><linearGradient id="fc-sky" x2="0" y2="1"><stop stopColor="#65c6b1"/><stop offset="1" stopColor="#1e576f"/></linearGradient></defs>
      <rect width="160" height="160" fill="url(#fc-sky)"/>
      <path d="M-10 108L77 63 170 108 82 159Z" fill="#559d6c" stroke="#a4d38d" strokeWidth="3"/>
      <path d="M37 93L79 71 123 93 78 118Z" fill="#c3b881"/>
      <path d="M55 84V51L82 38 108 51V83L82 98Z" fill="#dcbf84" stroke="#896d48" strokeWidth="3"/>
      <path d="M55 51L82 36 108 51 82 64Z" fill="#f4d9a5"/><path d="M75 98V76H88V98" fill="#62543f"/>
      <path d="M20 120L20 92M29 126V93M136 123V90" stroke="#244d35" strokeWidth="11" strokeLinecap="round"/>
      <path d="M13 85L21 66 33 86ZM121 87L134 55 148 87Z" fill="#29844f"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 160 160" role="presentation">
      <rect width="160" height="160" fill="#333c66"/>
      <path d="M0 119L83 70 160 115V160H0Z" fill="#667b91"/>
      <g fill="#293c50" stroke="#9fb4c7" strokeWidth="3"><rect x="28" y="67" width="65" height="55" rx="4"/><rect x="98" y="40" width="37" height="72" rx="4"/></g>
      <path d="M42 67V44H75V67M114 40V20" fill="none" stroke="#e9ae59" strokeWidth="9"/>
      <circle cx="61" cy="93" r="21" fill="#172331" stroke="#fbaf50" strokeWidth="8"/><circle cx="61" cy="93" r="8" fill="#89dbe7"/>
      <path d="M85 94H118M118 94V74" stroke="#ffcb75" strokeWidth="9" strokeLinecap="round" />
      <path d="M122 46L151 63 122 79Z" fill="#e58c54"/>
      <circle cx="130" cy="119" r="12" fill="#f3ba61" stroke="#182534" strokeWidth="5"/>
    </svg>
  );
}
