import { useState, useRef, useEffect } from 'react'

type Skin = 'cyber' | 'metal' | 'winamp'
type VizMode = 'bars' | 'circle' | 'wave'

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; color: string
}

function App() {
  const [tracks, setTracks] = useState<File[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [skin, setSkin] = useState<Skin>('cyber')
  const [vizMode, setVizMode] = useState<VizMode>('bars')
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])

  const skins = {
    cyber: { bg: '#0d0d1a', panel: '#111133', accent: '#00ffff', accent2: '#ff00ff', text: '#00ffff', border: '#00ffff44', barColor: (val: number) => `rgb(0, ${150 + val * 0.4}, 255)` },
    metal: { bg: '#1a1a1a', panel: '#2a2a2a', accent: '#c0c0c0', accent2: '#888888', text: '#e0e0e0', border: '#ffffff33', barColor: (val: number) => `rgb(${150 + val * 0.4}, ${150 + val * 0.4}, ${150 + val * 0.4})` },
    winamp: { bg: '#000000', panel: '#1a1a00', accent: '#ffaa00', accent2: '#ff6600', text: '#ffaa00', border: '#ffaa0044', barColor: (val: number) => `rgb(255, ${100 + val * 0.6}, 0)` },
  }

  const s = skins[skin]

  const setupAudio = () => {
    if (sourceRef.current || !audioRef.current) return
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    const source = ctx.createMediaElementSource(audioRef.current)
    source.connect(analyser)
    analyser.connect(ctx.destination)
    analyserRef.current = analyser
    sourceRef.current = source
  }

  const spawnParticles = (x: number, y: number, val: number, color: string) => {
    if (val < 180) return
    for (let i = 0; i < 2; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 3,
        vy: -(Math.random() * 3 + 1),
        life: 1,
        color,
      })
    }
  }

  const drawVisualizer = () => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return
    const ctx = canvas.getContext('2d')!
    const data = new Uint8Array(analyser.frequencyBinCount)
    const W = canvas.width
    const H = canvas.height

    const draw = () => {
      animRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(data)
      ctx.clearRect(0, 0, W, H)

      if (vizMode === 'bars') {
        const barWidth = W / data.length * 2.5
        let x = 0
        data.forEach((val) => {
          const barHeight = (val / 255) * H
          const color = s.barColor(val)
          // glow effect
          ctx.shadowBlur = 10
          ctx.shadowColor = s.accent
          ctx.fillStyle = color
          ctx.fillRect(x, H - barHeight, barWidth - 1, barHeight)
          spawnParticles(x + barWidth / 2, H - barHeight, val, color)
          x += barWidth
        })
      }

      if (vizMode === 'wave') {
        ctx.beginPath()
        ctx.strokeStyle = s.accent
        ctx.lineWidth = 2
        ctx.shadowBlur = 15
        ctx.shadowColor = s.accent
        const sliceWidth = W / data.length
        let x = 0
        data.forEach((val, i) => {
          const y = (val / 255) * H
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
          x += sliceWidth
        })
        ctx.stroke()
      }

      if (vizMode === 'circle') {
        const cx = W / 2, cy = H / 2
        const radius = 60
        ctx.shadowBlur = 15
        ctx.shadowColor = s.accent
        data.forEach((val, i) => {
          const angle = (i / data.length) * Math.PI * 2
          const len = (val / 255) * 80
          const x1 = cx + Math.cos(angle) * radius
          const y1 = cy + Math.sin(angle) * radius
          const x2 = cx + Math.cos(angle) * (radius + len)
          const y2 = cy + Math.sin(angle) * (radius + len)
          ctx.beginPath()
          ctx.strokeStyle = s.barColor(val)
          ctx.lineWidth = 2
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        })
      }

      // Draw particles
      ctx.shadowBlur = 0
      particlesRef.current = particlesRef.current.filter(p => p.life > 0)
      particlesRef.current.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.life -= 0.03
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, 2, 2)
      })
      ctx.globalAlpha = 1
    }
    draw()
  }

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setTracks(Array.from(e.target.files))
      setCurrentIndex(0)
    }
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    setupAudio()
    if (isPlaying) {
      audioRef.current.pause()
      cancelAnimationFrame(animRef.current)
    } else {
      audioRef.current.play()
      drawVisualizer()
    }
    setIsPlaying(!isPlaying)
  }

  const playTrack = (index: number) => {
    setCurrentIndex(index)
    setIsPlaying(true)
    setTimeout(() => {
      setupAudio()
      audioRef.current?.play()
      drawVisualizer()
    }, 100)
  }

  useEffect(() => {
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  useEffect(() => {
    if (isPlaying) {
      cancelAnimationFrame(animRef.current)
      drawVisualizer()
    }
  }, [vizMode, skin])

  const currentTrack = tracks[currentIndex]

  const btnStyle = {
    background: s.accent,
    color: s.bg,
    border: 'none',
    padding: '0.4rem 1rem',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontWeight: 'bold' as const,
    fontSize: '0.85rem',
    letterSpacing: '1px',
  }

  const skinBtn = (name: Skin) => ({
    background: skin === name ? s.accent : 'transparent',
    color: skin === name ? s.bg : s.accent,
    border: `1px solid ${s.accent}`,
    padding: '0.2rem 0.6rem',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    marginRight: '6px',
  })

  const vizBtn = (name: VizMode) => ({
    background: vizMode === name ? s.accent2 : 'transparent',
    color: vizMode === name ? s.bg : s.accent2,
    border: `1px solid ${s.accent2}`,
    padding: '0.2rem 0.6rem',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    marginRight: '6px',
  })

  return (
    <div style={{ background: s.bg, minHeight: '100vh', color: s.text, fontFamily: 'monospace', padding: '2rem', transition: 'all 0.3s' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ color: s.accent, fontSize: '1.8rem', margin: 0, letterSpacing: '4px' }}>⚡ NEOPULSE</h1>
        <div>
          <span style={{ fontSize: '0.7rem', color: s.accent2, marginRight: '8px' }}>SKIN:</span>
          <button style={skinBtn('cyber')} onClick={() => setSkin('cyber')}>CYBER</button>
          <button style={skinBtn('metal')} onClick={() => setSkin('metal')}>METAL</button>
          <button style={skinBtn('winamp')} onClick={() => setSkin('winamp')}>WINAMP</button>
        </div>
      </div>

      {/* Player panel */}
      <div style={{ background: s.panel, border: `1px solid ${s.border}`, padding: '1.5rem', marginBottom: '1rem', maxWidth: '640px' }}>

        {/* Track name */}
        <div style={{ background: s.bg, border: `1px solid ${s.border}`, padding: '0.4rem 0.8rem', marginBottom: '0.8rem', fontSize: '0.85rem', overflow: 'hidden', whiteSpace: 'nowrap', color: s.accent }}>
          {currentTrack ? `▶ ${currentTrack.name}` : '— NO TRACK LOADED —'}
        </div>

        {/* Viz mode switcher */}
        <div style={{ marginBottom: '0.8rem' }}>
          <span style={{ fontSize: '0.7rem', color: s.accent2, marginRight: '8px' }}>VIZ:</span>
          <button style={vizBtn('bars')} onClick={() => setVizMode('bars')}>BARS</button>
          <button style={vizBtn('wave')} onClick={() => setVizMode('wave')}>WAVE</button>
          <button style={vizBtn('circle')} onClick={() => setVizMode('circle')}>CIRCLE</button>
        </div>

        {/* Visualizer canvas */}
        <canvas
          ref={canvasRef}
          width={590}
          height={140}
          style={{ display: 'block', width: '100%', background: s.bg, border: `1px solid ${s.border}`, marginBottom: '1rem' }}
        />

        {/* Controls */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={btnStyle} onClick={() => playTrack(Math.max(0, currentIndex - 1))}>⏮ PREV</button>
          <button style={btnStyle} onClick={togglePlay}>{isPlaying ? '⏸ PAUSE' : '▶ PLAY'}</button>
          <button style={btnStyle} onClick={() => playTrack(Math.min(tracks.length - 1, currentIndex + 1))}>⏭ NEXT</button>
          <label style={{ ...btnStyle, display: 'inline-block' }}>
            📂 LOAD
            <input type="file" accept="audio/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
          </label>
        </div>

        <audio
          ref={audioRef}
          src={currentTrack ? URL.createObjectURL(currentTrack) : ''}
          onEnded={() => {
            if (currentIndex < tracks.length - 1) playTrack(currentIndex + 1)
            else setIsPlaying(false)
          }}
        />
      </div>

      {/* Playlist */}
      <div style={{ background: s.panel, border: `1px solid ${s.border}`, padding: '1rem', maxWidth: '640px' }}>
        <div style={{ fontSize: '0.7rem', color: s.accent2, marginBottom: '0.5rem', letterSpacing: '2px' }}>PLAYLIST — {tracks.length} TRACKS</div>
        {tracks.length === 0 && <p style={{ color: '#555', fontSize: '0.85rem' }}>No tracks loaded — click LOAD above</p>}
        {tracks.map((track, i) => (
          <div
            key={i}
            onClick={() => playTrack(i)}
            style={{
              padding: '0.4rem 0.8rem',
              marginBottom: '2px',
              background: i === currentIndex ? `${s.accent}22` : 'transparent',
              borderLeft: i === currentIndex ? `3px solid ${s.accent}` : '3px solid transparent',
              cursor: 'pointer',
              fontSize: '0.85rem',
              color: i === currentIndex ? s.accent : s.text,
            }}
          >
            {i + 1}. {track.name}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App