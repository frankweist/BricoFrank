// 🟢 Sube la base de datos local a Supabase
export async function syncPush() {
  try {
    // ... (otras líneas)
    console.log("📤 Subiendo backup a Supabase...");

    const clientes = await db.clientes.toArray();
    const equipos = await db.equipos.toArray(); // 💡 AÑADIDO: Obtener equipos
    const ordenes = await db.ordenes.toArray();
    const adjuntos = await db.adjuntos.toArray();

    // 💡 CORREGIDO: Incluir equipos en el payload
    const payload = { clientes, equipos, ordenes, adjuntos, fecha: new Date().toISOString() };

    const { error } = await supa
      .from("backups")
      .upsert([{ id: ROW_ID, fecha: new Date().toISOString(), payload }], { onConflict: "id" });

    if (error) throw error;

    console.log("✅ Backup subido correctamente.");
    // ... (otras líneas)
  } catch (err: any) {
    // ...
  }
}

// 🔵 Descarga los datos desde Supabase a la base local
export async function syncPull() {
  try {
    // ... (otras líneas)

    // ... (código que obtiene data y maneja el error) ...

    const backupData = data?.[0]?.payload;

    if (!backupData) {
      console.log("⚠️ No se encontró backup en Supabase para este ID. Inicializando vacío.");
      setSyncState("ok");
      return;
    }

    // 💡 CORREGIDO: Destructurar equipos
    const { clientes, equipos, ordenes, adjuntos } = backupData;

    // Limpia e inserta los datos locales
    // 💡 CORREGIDO: Incluir db.equipos en la transacción
    await db.transaction("rw", db.clientes, db.equipos, db.ordenes, db.adjuntos, async () => {
      await db.clientes.clear();
      await db.equipos.clear(); // 💡 AÑADIDO: Limpiar equipos
      await db.ordenes.clear();
      await db.adjuntos.clear();

      await db.clientes.bulkAdd(clientes || []);
      await db.equipos.bulkAdd(equipos || []); // 💡 AÑADIDO: Insertar equipos
      await db.ordenes.bulkAdd(ordenes || []);
      await db.adjuntos.bulkAdd(adjuntos || []);
    });

    console.log("✅ Datos restaurados desde Supabase.");
    // ... (otras líneas)
  } catch (err: any) {
    // ...
  }
}