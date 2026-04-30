const getHelloFromDb = async () => ({ hello: 'world ' })

export const resolveHello = async () => getHelloFromDb()
