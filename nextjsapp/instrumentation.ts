export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initMqtt } = await import('./lib/mqtt')
    initMqtt()
  }
}
