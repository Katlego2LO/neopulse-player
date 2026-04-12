import { useState, useRef, useEffect } from 'react'

function App() {
  const [tracks, setTracks] = useState<File[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [skin, setSkin] = useState<'cyber' | 'metal' | 'winamp'>('cyber')
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animRef = useRef<number>(0)

  const skins = {
    cyber: { bg: '#0d0d1a', panel: '#111133', accent: '#00ffff', accent2: '#ff00ff', text: '#00ffff', border: '#00ffff44' },
    metal: { bg: '#1a1a1a', panel: '#2a2a2a', accent: '#c0c0c0', accent2: '#888888', text: '#e0e0e0', border: '#ffffff33' },
    winamp: { bg: '#000000', panel: '#1a1a00', accent: '#ffaa00', accent2: '#ff6600', text: '#ffaa00', border: '#ffaa0044' },
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

  const drawVisualizer = () => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return
    const ctx = canvas.getContext('2d')!
    const data = new Uint8Array(analyser.frequencyBinCount)

    const draw = () => {
      animRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(data)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const barWidth = canvas.width / data.length * 2.5
      let x = 0
      data.forEach((val) => {
        const barHeight = (val / 255) * canvas.height
        if (skin === 'cyber') ctx.fillStyle = `rgb(0, ${150 + val * 0.4}, 255)`
        else if (skin === 'metal') ctx.fillStyle = `rgb(${150 + val * 0.4}, ${150 + val * 0.4}, ${150 + val * 0.4})`
        else ctx.fillStyle = `rgb(255, ${100 + val * 0.6}, 0)`
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight)
        x += barWidth
      })
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

  const currentTrack = tracks[currentIndex]

  const btnStyle = {
    background: s.accent,
    color: s.bg,
    border: 'none',
    padding: '0.4rem 1rem',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: '0.85rem',
    letterSpacing: '1px',
  }

  const skinBtn = (name: typeof skin) => ({
    background: skin === name ? s.accent : 'transparent',
    color: skin === name ? s.bg : s.accent,
    border: `1px solid ${s.accent}`,
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
        <h1 style={{ color: s.accent, fontSize: '1.8rem', margin: 0, letterSpacing: '4px', textTransform: 'uppercase' }}>
          ⚡ NeoPulse
        </h1>
        <div>
          <span style={{ fontSize: '0.7rem', color: s.accent2, marginRight: '8px' }}>SKIN:</span>
          <button style={skinBtn('cyber')} onClick={() => setSkin('cyber')}>CYBER</button>
          <button style={skinBtn('metal')} onClick={() => setSkin('metal')}>METAL</button>
          <button style={skinBtn('winamp')} onClick={() => setSkin('winamp')}>WINAMP</button>
        </div>
      </div>

      {/* Player panel */}
      <div style={{ background: s.panel, border: `1px solid ${s.border}`, padding: '1.5rem', marginBottom: '1rem', maxWidth: '640px' }}>

        {/* Track name marquee */}
        <div style={{ background: s.bg, border: `1px solid ${s.border}`, padding: '0.4rem 0.8rem', marginBottom: '1rem', fontSize: '0.85rem', overflow: 'hidden', whiteSpace: 'nowrap', color: s.accent }}>
          {currentTrack ? `▶ ${currentTrack.name}` : '— NO TRACK LOADED —'}
        </div>

        {/* Visualizer */}
        <canvas
          ref={canvasRef}
          width={590}
          height={120}
          style={{ display: 'block', width: '100%', background: s.bg, border: `1px solid ${s.border}`, marginBottom: '1rem' }}
        />

        {/* Controls */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
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
              transition: 'all 0.1s',
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