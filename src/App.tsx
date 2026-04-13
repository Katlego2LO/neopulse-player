import { useState, useRef, useEffect } from 'react'

type Skin = 'cyber' | 'luxe' | 'chrome'
type VizMode = 'bars' | 'wave' | 'circle' | 'mirror' | 'psychedelic' | 'inferno' | 'starfield'

interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }
interface Star { x: number; y: number; angle: number; speed: number; size: number }

const SKINS = {
  cyber: {
    bgSolid: '#050510',
    bg: 'radial-gradient(ellipse at 20% 50%, #0a0a2e 0%, #050510 60%), radial-gradient(ellipse at 80% 20%, #001a1a 0%, transparent 50%)',
    panel: 'rgba(0,255,255,0.04)',
    panelBorder: 'rgba(0,255,255,0.2)',
    accent: '#00ffff',
    accent2: '#ff00ff',
    accent3: '#7b2fff',
    glow: '0 0 25px rgba(0,255,255,0.5), 0 0 50px rgba(0,255,255,0.2)',
    glow2: '0 0 25px rgba(255,0,255,0.5)',
    text: '#e0ffff',
    subtext: 'rgba(0,255,255,0.5)',
    scanline: 'rgba(0,255,255,0.03)',
    barColor: (v: number) => `hsl(${180 + v * 0.4}, 100%, ${35 + v * 0.22}%)`,
    name: 'CYBER',
  },
  luxe: {
    bgSolid: '#08000f',
    bg: 'radial-gradient(ellipse at 30% 40%, #1a0028 0%, #08000f 60%), radial-gradient(ellipse at 70% 70%, #1a0a00 0%, transparent 50%)',
    panel: 'rgba(180,100,255,0.05)',
    panelBorder: 'rgba(212,175,55,0.25)',
    accent: '#d4af37',
    accent2: '#b464ff',
    accent3: '#ff6eb4',
    glow: '0 0 25px rgba(212,175,55,0.6), 0 0 50px rgba(212,175,55,0.2)',
    glow2: '0 0 25px rgba(180,100,255,0.5)',
    text: '#fff8e7',
    subtext: 'rgba(212,175,55,0.55)',
    scanline: 'rgba(212,175,55,0.02)',
    barColor: (v: number) => `hsl(${40 + v * 0.15}, 95%, ${35 + v * 0.22}%)`,
    name: 'LUXE',
  },
  chrome: {
    bgSolid: '#060606',
    bg: 'radial-gradient(ellipse at 50% 30%, #111111 0%, #060606 70%)',
    panel: 'rgba(255,255,255,0.03)',
    panelBorder: 'rgba(255,255,255,0.12)',
    accent: '#ffffff',
    accent2: '#ff3333',
    accent3: '#3366ff',
    glow: '0 0 25px rgba(255,255,255,0.4), 0 0 50px rgba(255,255,255,0.1)',
    glow2: '0 0 25px rgba(255,51,51,0.5)',
    text: '#ffffff',
    subtext: 'rgba(255,255,255,0.4)',
    scanline: 'rgba(255,255,255,0.02)',
    barColor: (v: number) => `hsl(0, 0%, ${25 + v * 0.3}%)`,
    name: 'CHROME',
  },
}

export default function App() {
  const [tracks, setTracks] = useState<File[]>([])
  const [audioUrls, setAudioUrls] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [skin, setSkin] = useState<Skin>('cyber')
  const [vizMode, setVizMode] = useState<VizMode>('bars')
  const [volume, setVolume] = useState(0.8)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bass, setBass] = useState(0)
  const [mid, setMid] = useState(0)
  const [treble, setTreble] = useState(0)

  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])
  const starsRef = useRef<Star[]>([])
  const rotRef = useRef(0)
  const vizModeRef = useRef(vizMode)
  const skinRef = useRef(skin)
  const bassFilterRef = useRef<BiquadFilterNode | null>(null)
  const midFilterRef = useRef<BiquadFilterNode | null>(null)
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null)

  useEffect(() => { vizModeRef.current = vizMode }, [vizMode])
  useEffect(() => { skinRef.current = skin }, [skin])
  useEffect(() => { return () => { audioUrls.forEach(url => URL.revokeObjectURL(url)) } }, [audioUrls])
  useEffect(() => { return () => cancelAnimationFrame(animRef.current) }, [])
  useEffect(() => { starsRef.current = []; rotRef.current = 0; if (isPlaying) drawVisualizer() }, [vizMode, skin])
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume }, [volume])
  useEffect(() => { if (bassFilterRef.current) bassFilterRef.current.gain.value = bass }, [bass])
  useEffect(() => { if (midFilterRef.current) midFilterRef.current.gain.value = mid }, [mid])
  useEffect(() => { if (trebleFilterRef.current) trebleFilterRef.current.gain.value = treble }, [treble])

  const s = SKINS[skin]

  const setupAudio = async () => {
    if (!audioRef.current) return
    if (!audioCtxRef.current) {
      const ctx = new AudioContext()
      audioCtxRef.current = ctx

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512

      const bassFilter = ctx.createBiquadFilter()
      bassFilter.type = 'lowshelf'
      bassFilter.frequency.value = 200
      bassFilter.gain.value = 0
      bassFilterRef.current = bassFilter

      const midFilter = ctx.createBiquadFilter()
      midFilter.type = 'peaking'
      midFilter.frequency.value = 1000
      midFilter.Q.value = 1
      midFilter.gain.value = 0
      midFilterRef.current = midFilter

      const trebleFilter = ctx.createBiquadFilter()
      trebleFilter.type = 'highshelf'
      trebleFilter.frequency.value = 3000
      trebleFilter.gain.value = 0
      trebleFilterRef.current = trebleFilter

      const source = ctx.createMediaElementSource(audioRef.current)
      source.connect(bassFilter)
      bassFilter.connect(midFilter)
      midFilter.connect(trebleFilter)
      trebleFilter.connect(analyser)
      analyser.connect(ctx.destination)

      analyserRef.current = analyser
      sourceRef.current = source
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume()
    }
  }

  const drawVisualizer = () => {
    cancelAnimationFrame(animRef.current)
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')!
    const data = new Uint8Array(analyser.frequencyBinCount)
    const W = canvas.width
    const H = canvas.height

    if (starsRef.current.length === 0) {
      for (let i = 0; i < 180; i++) {
        starsRef.current.push({ x: W / 2, y: H / 2, angle: Math.random() * Math.PI * 2, speed: Math.random() * 2 + 0.5, size: Math.random() * 2 + 0.5 })
      }
    }

    const loop = () => {
      animRef.current = requestAnimationFrame(loop)
      analyser.getByteFrequencyData(data)

      const avg = data.reduce((a, b) => a + b, 0) / data.length
      const bass = data.slice(0, 10).reduce((a, b) => a + b, 0) / 10
      const currentSkin = SKINS[skinRef.current]
      const currentViz = vizModeRef.current

      const fade = currentViz === 'psychedelic' || currentViz === 'starfield'
      ctx.fillStyle = fade ? 'rgba(0,0,0,0.13)' : currentSkin.bgSolid
      ctx.fillRect(0, 0, W, H)

      if (currentViz === 'bars') {
        const bw = (W / data.length) * 2.2
        data.forEach((val, i) => {
          const bh = (val / 255) * H * 0.95
          const color = currentSkin.barColor(val)
          const grad = ctx.createLinearGradient(0, H, 0, H - bh)
          grad.addColorStop(0, color)
          grad.addColorStop(0.6, currentSkin.accent)
          grad.addColorStop(1, currentSkin.accent2)
          ctx.shadowBlur = 14; ctx.shadowColor = color
          ctx.fillStyle = grad
          ctx.fillRect(i * bw, H - bh, bw - 2, bh)
          ctx.fillStyle = '#fff'
          ctx.shadowBlur = 8; ctx.shadowColor = '#fff'
          ctx.fillRect(i * bw, H - bh - 2, bw - 2, 2)
          if (val > 175 && particlesRef.current.length < 300) {
            particlesRef.current.push({ x: i * bw + bw / 2, y: H - bh, vx: (Math.random() - 0.5) * 4, vy: -(Math.random() * 4 + 1), life: 1, color })
          }
        })
      }

      if (currentViz === 'wave') {
        [currentSkin.accent3, currentSkin.accent2, currentSkin.accent].forEach((col, pass) => {
          ctx.beginPath()
          ctx.strokeStyle = col
          ctx.lineWidth = pass === 2 ? 3 : 1.5
          ctx.shadowBlur = 20; ctx.shadowColor = col
          ctx.globalAlpha = pass === 2 ? 1 : 0.4
          data.forEach((val, i) => {
            const x = (i / data.length) * W
            const offset = (pass - 1) * 18
            const y = H / 2 + ((val - 128) / 128) * H * 0.42 + offset
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          })
          ctx.stroke()
        })
        ctx.globalAlpha = 1
      }

      if (currentViz === 'circle') {
        const cx = W / 2, cy = H / 2
        const r = 65 + bass * 0.12
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2)
        ctx.strokeStyle = currentSkin.accent; ctx.lineWidth = 1
        ctx.shadowBlur = 20; ctx.shadowColor = currentSkin.accent
        ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1
        data.forEach((val, i) => {
          const angle = (i / data.length) * Math.PI * 2 - Math.PI / 2
          const len = (val / 255) * 95
          const color = currentSkin.barColor(val)
          ctx.beginPath()
          ctx.strokeStyle = color; ctx.lineWidth = 2.5
          ctx.shadowBlur = 12; ctx.shadowColor = color
          ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r)
          ctx.lineTo(cx + Math.cos(angle) * (r + len), cy + Math.sin(angle) * (r + len))
          ctx.stroke()
        })
      }

      if (currentViz === 'mirror') {
        const bw = (W / data.length) * 2.2
        data.forEach((val, i) => {
          const bh = (val / 255) * (H / 2) * 0.95
          const color = currentSkin.barColor(val)
          ctx.shadowBlur = 12; ctx.shadowColor = color
          const g1 = ctx.createLinearGradient(0, H / 2, 0, H / 2 - bh)
          g1.addColorStop(0, color); g1.addColorStop(1, currentSkin.accent2)
          ctx.fillStyle = g1; ctx.fillRect(i * bw, H / 2 - bh, bw - 2, bh)
          const g2 = ctx.createLinearGradient(0, H / 2, 0, H / 2 + bh)
          g2.addColorStop(0, color); g2.addColorStop(1, currentSkin.accent2)
          ctx.globalAlpha = 0.5; ctx.fillStyle = g2; ctx.fillRect(i * bw, H / 2, bw - 2, bh)
          ctx.globalAlpha = 1
        })
        ctx.beginPath()
        ctx.strokeStyle = currentSkin.accent; ctx.lineWidth = 1
        ctx.shadowBlur = 15; ctx.shadowColor = currentSkin.accent
        ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()
      }

      if (currentViz === 'psychedelic') {
        rotRef.current += 0.007 + (avg / 255) * 0.045
        const cx = W / 2, cy = H / 2
        for (let ring = 0; ring < 4; ring++) {
          data.forEach((val, i) => {
            const hue = (i / data.length * 360 + rotRef.current * 55 + ring * 90) % 360
            const angle = (i / data.length) * Math.PI * 2 + rotRef.current + ring * 0.25
            const minR = 15 + ring * 28
            const len = minR + (val / 255) * (75 - ring * 12)
            ctx.beginPath()
            ctx.strokeStyle = `hsla(${hue}, 100%, 65%, ${0.85 - ring * 0.18})`
            ctx.lineWidth = 2.5 - ring * 0.4
            ctx.shadowBlur = 20; ctx.shadowColor = `hsl(${hue}, 100%, 60%)`
            ctx.moveTo(cx + Math.cos(angle) * minR, cy + Math.sin(angle) * minR)
            ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len)
            ctx.stroke()
          })
        }
      }

      if (currentViz === 'inferno') {
        const bw = (W / data.length) * 2.2
        data.forEach((val, i) => {
          const bh = (val / 255) * H * 0.95
          const grad = ctx.createLinearGradient(0, H, 0, H - bh)
          grad.addColorStop(0, '#ff0000')
          grad.addColorStop(0.3, '#ff5500')
          grad.addColorStop(0.6, '#ffaa00')
          grad.addColorStop(0.85, '#ffee44')
          grad.addColorStop(1, '#ffffff')
          ctx.shadowBlur = 18; ctx.shadowColor = '#ff4400'
          ctx.fillStyle = grad
          ctx.fillRect(i * bw, H - bh, bw - 2, bh)
          if (val > 145 && particlesRef.current.length < 400) {
            particlesRef.current.push({ x: i * bw + bw / 2, y: H - bh, vx: (Math.random() - 0.5) * 5, vy: -(Math.random() * 6 + 2), life: 1, color: `hsl(${Math.random() * 55}, 100%, 60%)` })
          }
        })
      }

      if (currentViz === 'starfield') {
        const cx = W / 2, cy = H / 2
        const boost = 1 + (bass / 255) * 5
        starsRef.current.forEach(star => {
          star.x += Math.cos(star.angle) * star.speed * boost
          star.y += Math.sin(star.angle) * star.speed * boost
          if (star.x < 0 || star.x > W || star.y < 0 || star.y > H) {
            star.x = cx; star.y = cy; star.angle = Math.random() * Math.PI * 2
          }
          const hue = (star.angle * 57 + avg * 2) % 360
          ctx.beginPath()
          ctx.fillStyle = `hsl(${hue}, 100%, 75%)`
          ctx.shadowBlur = 8; ctx.shadowColor = `hsl(${hue}, 100%, 75%)`
          ctx.arc(star.x, star.y, star.size * (0.5 + bass / 200), 0, Math.PI * 2)
          ctx.fill()
        })
      }

      ctx.shadowBlur = 0
      particlesRef.current = particlesRef.current.filter(p => p.life > 0)
      particlesRef.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= 0.022
        ctx.globalAlpha = p.life * 0.9
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, 2, 2)
      })
      ctx.globalAlpha = 1
    }
    loop()
  }

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      const urls = files.map(file => URL.createObjectURL(file))
      setTracks(files)
      setAudioUrls(urls)
      setCurrentIndex(0)
    }
  }

  const togglePlay = async () => {
    if (!audioRef.current) return
    await setupAudio()
    if (isPlaying) {
      audioRef.current.pause()
      cancelAnimationFrame(animRef.current)
      setIsPlaying(false)
    } else {
      try {
        await audioRef.current.play()
        drawVisualizer()
        setIsPlaying(true)
      } catch (err) { console.error('Playback error:', err) }
    }
  }

  const playTrack = async (index: number) => {
    if (!audioRef.current) return
    cancelAnimationFrame(animRef.current)
    setCurrentIndex(index)
    setIsPlaying(false)
    await setupAudio()
    setTimeout(async () => {
      try {
        await audioRef.current!.play()
        drawVisualizer()
        setIsPlaying(true)
      } catch (err) { console.error('Playback error:', err) }
    }, 80)
  }

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) audioRef.current.currentTime = Number(e.target.value)
  }

  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

  const currentAudioUrl = audioUrls[currentIndex] || ''

  const VIZ_MODES: { mode: VizMode; icon: string; label: string }[] = [
    { mode: 'bars', icon: '▊', label: 'BARS' },
    { mode: 'wave', icon: '〜', label: 'WAVE' },
    { mode: 'circle', icon: '◎', label: 'ORBIT' },
    { mode: 'mirror', icon: '⬍', label: 'MIRROR' },
    { mode: 'psychedelic', icon: '✦', label: 'PSYCHO' },
    { mode: 'inferno', icon: '▲', label: 'INFERNO' },
    { mode: 'starfield', icon: '✸', label: 'STARS' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: s.bg, color: s.text, fontFamily: "'Rajdhani', sans-serif", position: 'relative', overflow: 'hidden' }}>

      <div style={{ position: 'fixed', inset: 0, backgroundImage: `repeating-linear-gradient(0deg, ${s.scanline} 0px, ${s.scanline} 1px, transparent 1px, transparent 4px)`, pointerEvents: 'none', zIndex: 10 }} />
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `linear-gradient(${s.panelBorder} 1px, transparent 1px), linear-gradient(90deg, ${s.panelBorder} 1px, transparent 1px)`, backgroundSize: '60px 60px', opacity: 0.15, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 2, padding: '1.2rem 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem', paddingBottom: '1rem', borderBottom: `1px solid ${s.panelBorder}` }}>
          <div>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '2.4rem', fontWeight: 900, color: s.accent, textShadow: s.glow, letterSpacing: '6px', lineHeight: 1 }}>NEOPULSE</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.62rem', color: s.subtext, letterSpacing: '4px', marginTop: '2px' }}>◈ Y2K MUSIC EXPERIENCE ◈</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['cyber', 'luxe', 'chrome'] as Skin[]).map(sk => (
                <button key={sk} onClick={() => setSkin(sk)} style={{
                  fontFamily: "'Orbitron', sans-serif", fontSize: '0.58rem', letterSpacing: '2px',
                  padding: '7px 16px', cursor: 'pointer',
                  border: `1px solid ${skin === sk ? s.accent : s.panelBorder}`,
                  background: skin === sk ? `${s.accent}18` : 'transparent',
                  color: skin === sk ? s.accent : s.subtext,
                  boxShadow: skin === sk ? s.glow : 'none',
                  transition: 'all 0.2s',
                }}>{SKINS[sk].name}</button>
              ))}
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', color: s.subtext }}>
              {new Date().toLocaleTimeString()} — {tracks.length} TRACKS
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '14px' }}>

          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Now Playing */}
            <div style={{ background: s.panel, border: `1px solid ${s.panelBorder}`, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '14px', backdropFilter: 'blur(10px)' }}>
              <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '20px' }}>
                {[1, 0.6, 0.8, 0.4, 0.9].map((h, i) => (
                  <div key={i} style={{ width: '3px', background: s.accent, boxShadow: `0 0 6px ${s.accent}`, height: isPlaying ? `${h * 20}px` : '4px', transition: 'height 0.3s', animation: isPlaying ? `eq${i} ${0.4 + i * 0.1}s ease-in-out infinite alternate` : 'none' }} />
                ))}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.9rem', color: s.accent, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {tracks[currentIndex] ? tracks[currentIndex].name.replace(/\.[^/.]+$/, '').toUpperCase() : '— SELECT A TRACK TO BEGIN —'}
                </div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: '0.72rem', color: s.subtext }}>
                  {isPlaying ? '▶ NOW PLAYING' : '⏸ PAUSED'} · {fmt(progress)} / {fmt(duration)}
                </div>
              </div>
            </div>

            {/* Visualizer Canvas */}
            <div style={{ position: 'relative', border: `1px solid ${s.panelBorder}`, background: s.bgSolid, overflow: 'hidden' }}>
              {['top:0;left:0', 'top:0;right:0', 'bottom:0;left:0', 'bottom:0;right:0'].map((pos, i) => (
                <div key={i} style={{ position: 'absolute', ...Object.fromEntries(pos.split(';').map(p => p.split(':'))), width: '16px', height: '16px', borderTop: i < 2 ? `2px solid ${s.accent}` : 'none', borderBottom: i >= 2 ? `2px solid ${s.accent}` : 'none', borderLeft: i % 2 === 0 ? `2px solid ${s.accent}` : 'none', borderRight: i % 2 === 1 ? `2px solid ${s.accent}` : 'none', zIndex: 2 }} />
              ))}
              <canvas ref={canvasRef} width={760} height={240} style={{ display: 'block', width: '100%' }} />
            </div>

            {/* Progress Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', color: s.subtext, minWidth: '35px' }}>{fmt(progress)}</span>
              <div style={{ flex: 1, position: 'relative', height: '4px', background: s.panelBorder, cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${duration ? (progress / duration) * 100 : 0}%`, background: s.accent, boxShadow: s.glow }} />
                <input type="range" min={0} max={duration || 100} value={progress} onChange={seek} style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer' }} />
              </div>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', color: s.subtext, minWidth: '35px', textAlign: 'right' }}>{fmt(duration)}</span>
            </div>

            {/* Controls */}
            <div style={{ background: s.panel, border: `1px solid ${s.panelBorder}`, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px', backdropFilter: 'blur(10px)' }}>
              <button onClick={() => playTrack(Math.max(0, currentIndex - 1))} style={ctrlBtn(s, false)}>⏮</button>
              <button onClick={togglePlay} style={ctrlBtn(s, true)}>{isPlaying ? '⏸' : '▶'}</button>
              <button onClick={() => playTrack(Math.min(tracks.length - 1, currentIndex + 1))} style={ctrlBtn(s, false)}>⏭</button>
              <div style={{ width: '1px', height: '30px', background: s.panelBorder, margin: '0 6px' }} />
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', color: s.subtext }}>VOL</span>
              <div style={{ position: 'relative', width: '90px', height: '4px', background: s.panelBorder }}>
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${volume * 100}%`, background: s.accent2, boxShadow: s.glow2 }} />
                <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e => setVolume(Number(e.target.value))} style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer' }} />
              </div>
              <div style={{ flex: 1 }} />
              <label style={{ ...ctrlBtn(s, false), display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                ◈ LOAD FILES
                <input type="file" accept="audio/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Viz Mode Buttons */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {VIZ_MODES.map(({ mode, icon, label }) => (
                <button key={mode} onClick={() => setVizMode(mode)} style={{
                  fontFamily: "'Orbitron', sans-serif", fontSize: '0.52rem', letterSpacing: '1.5px',
                  padding: '7px 13px', cursor: 'pointer', flex: '1 1 auto',
                  border: `1px solid ${vizMode === mode ? s.accent2 : s.panelBorder}`,
                  background: vizMode === mode ? `${s.accent2}20` : s.panel,
                  color: vizMode === mode ? s.accent2 : s.subtext,
                  boxShadow: vizMode === mode ? s.glow2 : 'none',
                  transition: 'all 0.15s',
                }}>{icon} {label}</button>
              ))}
            </div>

            {/* Equalizer */}
            <div style={{ background: s.panel, border: `1px solid ${s.panelBorder}`, padding: '14px 18px', backdropFilter: 'blur(10px)' }}>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.6rem', letterSpacing: '3px', color: s.accent, marginBottom: '14px' }}>◈ EQUALIZER</div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>

                {[
                  { label: 'BASS', value: bass, set: setBass },
                  { label: 'MID', value: mid, set: setMid },
                  { label: 'TREBLE', value: treble, set: setTreble },
                ].map(({ label, value, set }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', color: s.accent2 }}>
                      {value > 0 ? '+' : ''}{value}dB
                    </span>
                    <input
                      type="range" min={-12} max={12} step={1} value={value}
                      onChange={e => set(Number(e.target.value))}
                      style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '80px', cursor: 'pointer', accentColor: s.accent2 }}
                    />
                    <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.5rem', letterSpacing: '1px', color: s.subtext }}>{label}</span>
                  </div>
                ))}

                <button onClick={() => { setBass(0); setMid(0); setTreble(0) }} style={{
                  fontFamily: "'Orbitron', sans-serif", fontSize: '0.5rem', letterSpacing: '1px',
                  padding: '6px 10px', cursor: 'pointer', alignSelf: 'center',
                  border: `1px solid ${s.panelBorder}`, background: 'transparent',
                  color: s.subtext, transition: 'all 0.15s',
                }}>RESET</button>
              </div>
            </div>
          </div>

          {/* Playlist Sidebar */}
          <div style={{ background: s.panel, border: `1px solid ${s.panelBorder}`, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(10px)', maxHeight: '700px' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${s.panelBorder}`, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.62rem', letterSpacing: '3px', color: s.accent }}>◈ PLAYLIST</span>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.65rem', color: s.subtext }}>{tracks.length} TRK</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
              {tracks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: s.subtext }}>
                  <div style={{ fontSize: '3rem', opacity: 0.2, marginBottom: '12px' }}>◈</div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.7rem' }}>NO TRACKS LOADED</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '8px' }}>Click LOAD FILES to begin</div>
                </div>
              ) : tracks.map((track, i) => (
                <div key={i} onClick={() => playTrack(i)} style={{
                  padding: '9px 12px', marginBottom: '2px', cursor: 'pointer',
                  background: i === currentIndex ? `${s.accent}12` : 'transparent',
                  borderLeft: `2px solid ${i === currentIndex ? s.accent : 'transparent'}`,
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.6rem', color: s.subtext, minWidth: '22px', textAlign: 'right' }}>{String(i + 1).padStart(2, '0')}</span>
                  <div style={{ flex: 1, overflow: 'hidden', fontSize: '0.82rem', color: i === currentIndex ? s.accent : s.text, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {track.name.replace(/\.[^/.]+$/, '')}
                  </div>
                  {i === currentIndex && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.accent, boxShadow: s.glow, animation: isPlaying ? 'pulse 0.8s infinite' : 'none' }} />}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', color: s.subtext, fontSize: '0.58rem', opacity: 0.4 }}>
          NEOPULSE Y2K — REACT + WEB AUDIO API
        </div>
      </div>

      <audio
        ref={audioRef}
        src={currentAudioUrl}
        onTimeUpdate={() => setProgress(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => { if (currentIndex < tracks.length - 1) playTrack(currentIndex + 1); else setIsPlaying(false) }}
      />

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes eq0 { to { height: 18px } }
        @keyframes eq1 { to { height: 12px } }
        @keyframes eq2 { to { height: 16px } }
        @keyframes eq3 { to { height: 8px } }
        @keyframes eq4 { to { height: 20px } }
        button:hover { filter: brightness(1.3); transform: scale(1.02); }
      `}</style>
    </div>
  )
}

function ctrlBtn(s: typeof SKINS.cyber, primary: boolean) {
  return {
    fontFamily: "'Orbitron', sans-serif" as const,
    fontSize: primary ? '1.1rem' : '0.9rem',
    padding: primary ? '10px 28px' : '8px 18px',
    cursor: 'pointer' as const,
    border: `1px solid ${primary ? s.accent : s.panelBorder}`,
    background: primary ? `${s.accent}22` : 'transparent',
    color: primary ? s.accent : s.text,
    boxShadow: primary ? s.glow : 'none',
    transition: 'all 0.15s',
    letterSpacing: '2px',
  }
}