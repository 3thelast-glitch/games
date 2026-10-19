import { lazy, Suspense } from 'react';

/**
 * Historical gallery entry: old desktop routes now load the very same ONE
 * playable, approved 105-level game. No separate preview-only mode.
 * Lazy-loading also keeps Node server-render tests free of native APIs.
 */
const PlayableAppleWorm=lazy(async()=>{
  const module=await import('./AppleWormScreenshotGame.tsx');
  return {default:module.AppleWormScreenshotGame};
});

export function AppleWormSourceGallery({lang,onClose}:{
  lang:'ar'|'en';
  onClose:()=>void;
}) {
  return <Suspense fallback={<p role="status">
    {lang==='ar'?'جارٍ فتح لعبة دودة التفاح بالمراحل الـ105 المعتمدة…':
      'Opening the approved 105-stage Apple Worm game…'}
  </p>}>
    <PlayableAppleWorm onExit={onClose} settings={{
      lang,sound:true,haptics:true,reduceMotion:false,notifications:true,
    }}/>
  </Suspense>;
}
