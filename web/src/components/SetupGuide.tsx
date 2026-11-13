import type { ReactNode } from 'react'

/** Step-by-step setup of the local model builder on a Windows computer (workshop participants). */

function Cmd({ children }: { children: string }) {
  return <pre className="mt-1.5 overflow-x-auto rounded bg-banner px-2.5 py-1.5 text-xs text-ink">{children}</pre>
}

function Step({ n, title, time, children }: { n: number; title: string; time?: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg border border-line" open={n === 1}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">{n}</span>
        <span className="font-medium text-ink">{title}</span>
        {time && <span className="ml-auto text-xs text-ink-3">{time}</span>}
        <span className="text-ink-3 group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-2 border-t border-line px-3 py-3 text-sm leading-relaxed text-ink-2">{children}</div>
    </details>
  )
}

const TROUBLE: [string, ReactNode][] = [
  ['The page says "Local builder not running"', <>Check that the builder window is open and shows <code>model builder on http://127.0.0.1:8765</code>. Then allow the page to reach your computer: click the icon left of the address bar, set <b>Local network access</b> to <b>Allow</b>, and reload. Use Chrome or Edge.</>],
  ['"port 8765 is already in use"', <>The builder is already running in another window. Use that one, or close it and start again.</>],
  ['"missing input data"', <>The workshop data package is not in the right place. The folder <code>data</code> must sit inside the code folder, next to <code>scripts</code> and <code>src</code> (step 5).</>],
  ['"py" is not recognised', <>Python was installed without the launcher or is not on the PATH. Reinstall Python 3.12 and tick <b>Add python.exe to PATH</b> (step 2).</>],
  ['pip install fails or is very slow', <>Check the internet connection (or a proxy: <code>set HTTPS_PROXY=http://proxy:port</code> before pip). Your trainer can also give you the packages on a USB stick (offline install, step 6).</>],
  ['Docker Desktop does not start', <>Virtualisation must be enabled (Task Manager → Performance → CPU → Virtualisation: Enabled; otherwise enable it in the BIOS). If it asks for WSL, open PowerShell as administrator and run <code>wsl --update</code>, then restart.</>],
  ['The Run button is greyed out', <>Docker Desktop is not running (start it and wait for "Engine running"), the model has not been generated yet, or its quality check failed.</>],
  ['The model build fails while downloading', <>Terrain and land cover are downloaded for each new catchment: keep the computer online and try again. Files already downloaded are kept.</>],
  ['Files locked, strange errors when saving', <>Do not put the code folder in OneDrive, Desktop or Documents when they are synchronised. Use a short local path such as <code>C:\mdg</code>.</>],
]

export function SetupGuide() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">
        The page above talks to a small program (the <b>model builder</b>) running on your own computer: it builds the
        SFINCS model of the catchment you select, checks it, runs it with Docker and sends the results back to the page.
        Everything stays on your computer. These steps install it on <b>Windows 10 or 11</b>. Setup takes about an hour,
        most of it downloads: do steps 2, 3 and 6 with a good internet connection, before the workshop if you can.
      </p>

      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-line p-3">
          <div className="font-medium text-ink">Computer</div>
          <div className="text-ink-2">Windows 10 (22H2) or 11, 64-bit, Intel or AMD processor. 8 GB RAM minimum, 16 GB recommended. Administrator rights to install software.</div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="font-medium text-ink">Disk and internet</div>
          <div className="text-ink-2">15 GB free. About 3 GB to download once (Python packages, Docker, SFINCS image); then 10–50 MB per new catchment.</div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="font-medium text-ink">From your trainer</div>
          <div className="text-ink-2">The code (a ZIP of the repository or access to it) and the workshop data package <code>mdg_pluvial_workshop_data.zip</code> (210 MB).</div>
        </div>
      </div>

      <div className="space-y-2">
        <Step n={1} title="Check the computer" time="5 min">
          <p>Open <b>Task Manager</b> (Ctrl+Shift+Esc) → <b>Performance</b> → <b>CPU</b>. <b>Virtualisation</b> must say <b>Enabled</b>; Docker needs it. If it says Disabled, it must be switched on in the BIOS (ask your IT support).</p>
          <p>In <b>Settings → System → About</b>, check: 64-bit operating system, Windows 10 version 22H2 or Windows 11, and the installed RAM.</p>
        </Step>

        <Step n={2} title="Install Python 3.12" time="10 min">
          <p>Download the <b>Windows installer (64-bit)</b> of the latest Python <b>3.12</b> from <a className="text-accent underline underline-offset-2" href="https://www.python.org/downloads/windows/" target="_blank" rel="noreferrer">python.org/downloads/windows</a>. In the first screen of the installer, tick <b>Add python.exe to PATH</b>, then <b>Install Now</b>.</p>
          <p>Check it: open <b>PowerShell</b> (Start menu → type PowerShell) and run</p>
          <Cmd>py -3.12 --version</Cmd>
          <p>It should answer <code>Python 3.12.x</code>. Use 3.12 exactly: the pipeline was tested with it.</p>
        </Step>

        <Step n={3} title="Install Docker Desktop and the SFINCS image" time="20–30 min">
          <p>Download <b>Docker Desktop for Windows (AMD64)</b> from <a className="text-accent underline underline-offset-2" href="https://www.docker.com/products/docker-desktop/" target="_blank" rel="noreferrer">docker.com</a>, install it with the default options (<b>Use WSL 2</b>) and restart the computer. Open Docker Desktop, accept the terms and wait until it shows <b>Engine running</b>.</p>
          <p>Check it, then download the SFINCS model (527 MB):</p>
          <Cmd>{'docker run --rm hello-world\ndocker pull deltares/sfincs-cpu:sfincs-v2.4.1'}</Cmd>
          <p>If your trainer gives you the image on a USB stick instead: <code>docker load -i sfincs-v2.4.1.tar</code>.</p>
          <p className="text-ink-3">Docker Desktop is free for personal use, education, non-commercial open-source projects and organisations under 250 employees and USD 10 M revenue; larger organisations need a paid subscription.</p>
        </Step>

        <Step n={4} title="Put the code in a short local folder" time="5 min">
          <p>Create the folder <code>C:\mdg</code> and put the code there, so that you have <code>C:\mdg\pluvial_flood_modelling_madagascar</code> with the folders <code>scripts</code>, <code>src</code> and <code>config</code> inside.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>From a ZIP</b> given by your trainer: right-click → <b>Extract all</b> → <code>C:\mdg</code>.</li>
            <li><b>With Git</b>, if you were given access to the repository: <code>git clone &lt;repository address&gt;</code> inside <code>C:\mdg</code>.</li>
          </ul>
          <p>Avoid OneDrive, Desktop and Documents if they are synchronised, and long paths.</p>
        </Step>

        <Step n={5} title="Add the workshop data" time="5 min">
          <p>Right-click <code>mdg_pluvial_workshop_data.zip</code> → <b>Extract all</b> → choose the code folder <code>C:\mdg\pluvial_flood_modelling_madagascar</code>. A folder <code>data</code> appears next to <code>scripts</code>. Check that this file exists:</p>
          <Cmd>{'C:\\mdg\\pluvial_flood_modelling_madagascar\\data\\national\\rainfall\\catchment_eva.nc'}</Cmd>
          <p>The package holds the catchments, the rainfall record and design depths, and the curve numbers for Madagascar. Terrain and land cover are downloaded automatically for each catchment you build.</p>
        </Step>

        <Step n={6} title="Create the Python environment" time="10–20 min">
          <p>Open PowerShell in the code folder (in File Explorer, open the folder, click the address bar, type <code>powershell</code>, Enter). Run these lines one by one:</p>
          <Cmd>{'py -3.12 -m venv .venv\n.venv\\Scripts\\python.exe -m pip install --upgrade pip\n.venv\\Scripts\\python.exe -m pip install -r requirements.txt\n.venv\\Scripts\\python.exe -m pip install -e .'}</Cmd>
          <p>The third line downloads about 1 GB and takes several minutes. Then check:</p>
          <Cmd>{'.venv\\Scripts\\python.exe -c "import mdg_pluvial, hydromt_sfincs; print(\'ok\')"'}</Cmd>
          <p className="text-ink-3">Offline install: if your trainer gives you a <code>wheels</code> folder, put it in the code folder and replace the third line by <code>.venv\Scripts\python.exe -m pip install --no-index --find-links wheels -r requirements.txt</code>.</p>
        </Step>

        <Step n={7} title="Start the model builder" time="1 min">
          <p>Double-click <code>scripts\start_builder.bat</code> in the code folder (or run <code>.venv\Scripts\python.exe scripts\model_builder_server.py</code> in PowerShell). A black window opens and shows</p>
          <Cmd>model builder on http://127.0.0.1:8765</Cmd>
          <p><b>Keep this window open</b> while you work; closing it stops the builder. If Windows Firewall asks, you can click <b>Cancel</b>: the builder only talks to your own computer.</p>
        </Step>

        <Step n={8} title="Connect this page" time="1 min">
          <p>Open this site in <b>Chrome</b> or <b>Edge</b>, go to <b>Hazard → Model setup</b> and reload the page. When the browser asks to let the site reach devices on your local network, click <b>Allow</b>. Within 5 seconds the panel above shows <b>Local builder connected</b>.</p>
        </Step>

        <Step n={9} title="Build and run your first model" time="5–15 min">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Click a small catchment (under 100 km²) on the map. The map zooms to it.</li>
            <li>Keep <b>Non-cyclone</b>, choose a <b>10-year</b> return period and <b>50 m</b> resolution. The table shows the expected run time.</li>
            <li>Click <b>Generate SFINCS model and check</b>. The first build of a catchment downloads its terrain and takes 1–6 minutes. The quality report should say <b>PASS</b>.</li>
            <li>With Docker Desktop running, click <b>Run model</b>. When it finishes, the flood depth appears on the map with the flooded area, depths and water balance.</li>
          </ol>
          <p>The depth map is saved as a GeoTIFF in <code>models\&lt;catchment&gt;\runs\&lt;run&gt;\results\</code> and opens in QGIS. Run-time estimates adjust to your computer after the first runs.</p>
        </Step>
      </div>

      <div className="rounded-lg border border-line p-3">
        <div className="mb-1 font-medium text-ink">Next time</div>
        <p className="text-sm text-ink-2">Start Docker Desktop, double-click <code>scripts\start_builder.bat</code>, open this page. Steps 1–6 are done once.</p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">If something goes wrong</h3>
        <table className="w-full text-sm">
          <tbody>
            {TROUBLE.map(([q, a]) => (
              <tr key={q} className="border-b border-line align-top last:border-0">
                <td className="w-1/3 py-2 pr-3 font-medium text-ink">{q}</td>
                <td className="py-2 text-ink-2">{a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="rounded-lg border border-line">
        <summary className="cursor-pointer px-3 py-2 font-medium text-ink">For trainers: preparing a workshop</summary>
        <div className="space-y-2 border-t border-line px-3 py-3 text-sm text-ink-2">
          <p>On a machine where the pipeline already works:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>Data package</b> (about 210 MB; curve numbers clipped to Madagascar): <code>python scripts/make_workshop_package.py --out mdg_pluvial_workshop_data.zip</code></li>
            <li><b>Python packages for offline install</b> (Windows, Python 3.12): <code>pip download -r requirements.txt -d wheels --platform win_amd64 --python-version 3.12 --only-binary=:all:</code></li>
            <li><b>SFINCS image on USB</b>: <code>docker save deltares/sfincs-cpu:sfincs-v2.4.1 -o sfincs-v2.4.1.tar</code></li>
            <li><b>Code</b>: give read access to the repository, or a ZIP of it (without <code>data</code>, <code>models</code> and <code>outputs</code>).</li>
            <li>Test the whole sequence on one workshop computer beforehand, including Docker and the browser permission.</li>
          </ul>
        </div>
      </details>
    </div>
  )
}
