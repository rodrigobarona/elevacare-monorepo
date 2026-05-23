/** Shared Create workspace modal gate for static HTML labs (mirrors CreateWorkspaceModalMock). */
window.ElevaCreateSpaceGate = {
  mount(containerId, slug, onContinue) {
    const el = document.getElementById(containerId)
    if (!el) return
    let selected = null
    const types = [
      {
        id: "expert",
        title: "Expert",
        desc: "Run your independent practice on Eleva.",
      },
      {
        id: "team",
        title: "Team",
        desc: "Manage multiple experts under one organization.",
      },
      {
        id: "academy",
        title: "Academy",
        desc: "Publish and manage courses for your learners.",
      },
    ]
    function render() {
      el.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div class="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-xl">
            <h2 class="text-center text-2xl font-semibold">Create a workspace</h2>
            <p class="mt-2 text-center text-stone-500">Choose the type of workspace you want to create.</p>
            <div class="mt-8 grid gap-4 sm:grid-cols-3">
              ${types
                .map(
                  (t) => `
                <button type="button" data-type="${t.id}" class="create-space-type rounded-2xl border-2 p-6 text-center transition ${selected === t.id ? "border-stone-900 bg-stone-50 ring-2 ring-stone-900/20" : "border-stone-200 hover:border-stone-400"}">
                  <p class="text-lg font-medium">${t.title}</p>
                  <p class="mt-2 text-sm text-stone-500">${t.desc}</p>
                </button>`
                )
                .join("")}
            </div>
            <div class="mt-8 flex justify-end gap-3 border-t pt-6">
              <button type="button" id="create-space-cancel" class="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button type="button" id="create-space-continue" class="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-40" ${selected !== "expert" ? "disabled" : ""}>Continue</button>
            </div>
            ${selected && selected !== "expert" ? '<p class="mt-4 text-center text-xs text-stone-500">This POC demo covers the Expert path only.</p>' : ""}
          </div>
        </div>`
      el.querySelectorAll(".create-space-type").forEach((btn) => {
        btn.addEventListener("click", () => {
          selected = btn.getAttribute("data-type")
          render()
        })
      })
      const cont = el.querySelector("#create-space-continue")
      if (cont)
        cont.addEventListener("click", () => {
          if (selected !== "expert") return
          try {
            const key = "eleva-lab:" + slug
            const prev = JSON.parse(localStorage.getItem(key) || "{}")
            localStorage.setItem(
              key,
              JSON.stringify({ ...prev, spaceCreated: true })
            )
          } catch (e) {}
          el.innerHTML = ""
          onContinue()
        })
      const cancel = el.querySelector("#create-space-cancel")
      if (cancel)
        cancel.addEventListener("click", () => {
          el.innerHTML =
            '<div class="flex min-h-screen items-center justify-center"><button type="button" id="reopen-modal" class="text-sm underline">Open workspace modal</button></div>'
          document
            .getElementById("reopen-modal")
            ?.addEventListener("click", render)
        })
    }
    render()
  },
}
