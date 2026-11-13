import { useState, type ReactNode } from 'react'
import { Card, Segmented } from './ui'

/** Step-by-step setup of the local model builder on a Windows computer (workshop participants), EN / FR. */

type Lang = 'en' | 'fr'

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

const A = ({ href, children }: { href: string; children: ReactNode }) =>
  <a className="text-accent underline underline-offset-2" href={href} target="_blank" rel="noreferrer">{children}</a>

const VENV = 'py -3.12 -m venv .venv\n.venv\\Scripts\\python.exe -m pip install --upgrade pip\n.venv\\Scripts\\python.exe -m pip install -r requirements.txt\n.venv\\Scripts\\python.exe -m pip install -e .'
const CHECK = '.venv\\Scripts\\python.exe -c "import mdg_pluvial, hydromt_sfincs; print(\'ok\')"'
const DOCKER = 'docker run --rm hello-world\ndocker pull deltares/sfincs-cpu:sfincs-v2.4.1'
const EVA = 'C:\\mdg\\pluvial_flood_modelling_madagascar\\data\\national\\rainfall\\catchment_eva.nc'
const READY = 'model builder on http://127.0.0.1:8765'

interface Content {
  title: string; subtitle: string; intro: ReactNode
  boxes: [string, ReactNode][]
  steps: { title: string; time: string; body: ReactNode }[]
  nextTitle: string; next: ReactNode
  troubleTitle: string; trouble: [string, ReactNode][]
  trainerTitle: string; trainer: ReactNode
}

const EN: Content = {
  title: 'Set up the model builder on your computer (Windows)',
  subtitle: 'Step-by-step installation for workshop participants: Python, Docker, the code and the workshop data, then your first model.',
  intro: <>The page above talks to a small program (the <b>model builder</b>) running on your own computer: it builds the SFINCS model of the catchment you select, checks it, runs it with Docker and sends the results back to the page. Everything stays on your computer. These steps install it on <b>Windows 10 or 11</b>. Setup takes about an hour, most of it downloads: do steps 2, 3 and 6 with a good internet connection, before the workshop if you can.</>,
  boxes: [
    ['Computer', <>Windows 10 (22H2) or 11, 64-bit, Intel or AMD processor. 8 GB RAM minimum, 16 GB recommended. Administrator rights to install software.</>],
    ['Disk and internet', <>15 GB free. About 3 GB to download once (Python packages, Docker, SFINCS image); then 10–50 MB per new catchment.</>],
    ['From your trainer', <>The code (a ZIP of the repository or access to it) and the workshop data package <code>mdg_pluvial_workshop_data.zip</code> (210 MB).</>],
  ],
  steps: [
    { title: 'Check the computer', time: '5 min', body: <>
      <p>Open <b>Task Manager</b> (Ctrl+Shift+Esc) → <b>Performance</b> → <b>CPU</b>. <b>Virtualisation</b> must say <b>Enabled</b>; Docker needs it. If it says Disabled, it must be switched on in the BIOS (ask your IT support).</p>
      <p>In <b>Settings → System → About</b>, check: 64-bit operating system, Windows 10 version 22H2 or Windows 11, and the installed RAM.</p></> },
    { title: 'Install Python 3.12', time: '10 min', body: <>
      <p>Download the <b>Windows installer (64-bit)</b> of the latest Python <b>3.12</b> from <A href="https://www.python.org/downloads/windows/">python.org/downloads/windows</A>. In the first screen of the installer, tick <b>Add python.exe to PATH</b>, then <b>Install Now</b>.</p>
      <p>Check it: open <b>PowerShell</b> (Start menu → type PowerShell) and run</p>
      <Cmd>py -3.12 --version</Cmd>
      <p>It should answer <code>Python 3.12.x</code>. Use 3.12 exactly: the pipeline was tested with it.</p></> },
    { title: 'Install Docker Desktop and the SFINCS image', time: '20–30 min', body: <>
      <p>Download <b>Docker Desktop for Windows (AMD64)</b> from <A href="https://www.docker.com/products/docker-desktop/">docker.com</A>, install it with the default options (<b>Use WSL 2</b>) and restart the computer. Open Docker Desktop, accept the terms and wait until it shows <b>Engine running</b>.</p>
      <p>Check it, then download the SFINCS model (527 MB):</p>
      <Cmd>{DOCKER}</Cmd>
      <p>If your trainer gives you the image on a USB stick instead: <code>docker load -i sfincs-v2.4.1.tar</code>.</p>
      <p className="text-ink-3">Docker Desktop is free for personal use, education, non-commercial open-source projects and organisations under 250 employees and USD 10 M revenue; larger organisations need a paid subscription.</p></> },
    { title: 'Put the code in a short local folder', time: '5 min', body: <>
      <p>Create the folder <code>C:\mdg</code> and put the code there, so that you have <code>C:\mdg\pluvial_flood_modelling_madagascar</code> with the folders <code>scripts</code>, <code>src</code> and <code>config</code> inside.</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><b>From a ZIP</b> given by your trainer: right-click → <b>Extract all</b> → <code>C:\mdg</code>.</li>
        <li><b>With Git</b>, if you were given access to the repository: <code>git clone &lt;repository address&gt;</code> inside <code>C:\mdg</code>.</li>
      </ul>
      <p>Avoid OneDrive, Desktop and Documents if they are synchronised, and long paths.</p></> },
    { title: 'Add the workshop data', time: '5 min', body: <>
      <p>Right-click <code>mdg_pluvial_workshop_data.zip</code> → <b>Extract all</b> → choose the code folder <code>C:\mdg\pluvial_flood_modelling_madagascar</code>. A folder <code>data</code> appears next to <code>scripts</code>. Check that this file exists:</p>
      <Cmd>{EVA}</Cmd>
      <p>The package holds the catchments, the rainfall record and design depths, and the curve numbers for Madagascar. Terrain and land cover are downloaded automatically for each catchment you build.</p></> },
    { title: 'Create the Python environment', time: '10–20 min', body: <>
      <p>Open PowerShell in the code folder (in File Explorer, open the folder, click the address bar, type <code>powershell</code>, Enter). Run these lines one by one:</p>
      <Cmd>{VENV}</Cmd>
      <p>The third line downloads about 1 GB and takes several minutes. Then check:</p>
      <Cmd>{CHECK}</Cmd>
      <p className="text-ink-3">Offline install: if your trainer gives you a <code>wheels</code> folder, put it in the code folder and replace the third line by <code>.venv\Scripts\python.exe -m pip install --no-index --find-links wheels -r requirements.txt</code>.</p></> },
    { title: 'Start the model builder', time: '1 min', body: <>
      <p>Double-click <code>scripts\start_builder.bat</code> in the code folder (or run <code>.venv\Scripts\python.exe scripts\model_builder_server.py</code> in PowerShell). A black window opens and shows</p>
      <Cmd>{READY}</Cmd>
      <p><b>Keep this window open</b> while you work; closing it stops the builder. If Windows Firewall asks, you can click <b>Cancel</b>: the builder only talks to your own computer.</p></> },
    { title: 'Connect this page', time: '1 min', body: <>
      <p>Open this site in <b>Chrome</b> or <b>Edge</b>, go to <b>Hazard → Model setup</b> and reload the page. When the browser asks to let the site reach devices on your local network, click <b>Allow</b>. Within 5 seconds the panel above shows <b>Local builder connected</b>.</p></> },
    { title: 'Build and run your first model', time: '5–15 min', body: <>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Click a small catchment (under 100 km²) on the map. The map zooms to it.</li>
        <li>Keep <b>Non-cyclone</b>, choose a <b>10-year</b> return period and <b>50 m</b> resolution. The table shows the expected run time.</li>
        <li>Click <b>Generate SFINCS model and check</b>. The first build of a catchment downloads its terrain and takes 1–6 minutes. The quality report should say <b>PASS</b>.</li>
        <li>With Docker Desktop running, click <b>Run model</b>. When it finishes, the flood depth appears on the map with the flooded area, depths and water balance.</li>
      </ol>
      <p>The depth map is saved as a GeoTIFF in <code>models\&lt;catchment&gt;\runs\&lt;run&gt;\results\</code> and opens in QGIS. Run-time estimates adjust to your computer after the first runs.</p></> },
  ],
  nextTitle: 'Next time',
  next: <>Start Docker Desktop, double-click <code>scripts\start_builder.bat</code>, open this page. Steps 1–6 are done once.</>,
  troubleTitle: 'If something goes wrong',
  trouble: [
    ['The page says "Local builder not running"', <>Check that the builder window is open and shows <code>{READY}</code>. Then allow the page to reach your computer: click the icon left of the address bar, set <b>Local network access</b> to <b>Allow</b>, and reload. Use Chrome or Edge.</>],
    ['"port 8765 is already in use"', <>The builder is already running in another window. Use that one, or close it and start again.</>],
    ['"missing input data"', <>The workshop data package is not in the right place. The folder <code>data</code> must sit inside the code folder, next to <code>scripts</code> and <code>src</code> (step 5).</>],
    ['"py" is not recognised', <>Python was installed without the launcher or is not on the PATH. Reinstall Python 3.12 and tick <b>Add python.exe to PATH</b> (step 2).</>],
    ['pip install fails or is very slow', <>Check the internet connection (or a proxy: <code>$env:HTTPS_PROXY="http://proxy:port"</code> in PowerShell before pip). Your trainer can also give you the packages on a USB stick (offline install, step 6).</>],
    ['Docker Desktop does not start', <>Virtualisation must be enabled (step 1). If it asks for WSL, open PowerShell as administrator and run <code>wsl --update</code>, then restart.</>],
    ['The Run button is greyed out', <>Docker Desktop is not running (start it and wait for "Engine running"), the model has not been generated yet, or its quality check failed.</>],
    ['The model build fails while downloading', <>Terrain and land cover are downloaded for each new catchment: keep the computer online and try again. Files already downloaded are kept.</>],
    ['Files locked, strange errors when saving', <>Do not put the code folder in OneDrive, Desktop or Documents when they are synchronised. Use a short local path such as <code>C:\mdg</code>.</>],
  ],
  trainerTitle: 'For trainers: preparing a workshop',
  trainer: <>
    <p>On a machine where the pipeline already works:</p>
    <ul className="list-disc space-y-1 pl-5">
      <li><b>Data package</b> (about 210 MB; curve numbers clipped to Madagascar): <code>python scripts/make_workshop_package.py --out mdg_pluvial_workshop_data.zip</code></li>
      <li><b>Python packages for offline install</b> (Windows, Python 3.12): <code>pip download -r requirements.txt -d wheels --platform win_amd64 --python-version 3.12 --only-binary=:all:</code></li>
      <li><b>SFINCS image on USB</b>: <code>docker save deltares/sfincs-cpu:sfincs-v2.4.1 -o sfincs-v2.4.1.tar</code></li>
      <li><b>Code</b>: the repository is private. Give participants read access, or a ZIP of it (without <code>data</code>, <code>models</code> and <code>outputs</code>).</li>
      <li>Test the whole sequence on one workshop computer beforehand, including Docker and the browser permission.</li>
    </ul></>,
}

const FR: Content = {
  title: 'Installer le constructeur de modèles sur votre ordinateur (Windows)',
  subtitle: 'Installation pas à pas pour les participants aux ateliers : Python, Docker, le code et les données de l’atelier, puis votre premier modèle.',
  intro: <>La page ci-dessus communique avec un petit programme (le <b>constructeur de modèles</b>, « model builder ») qui tourne sur votre propre ordinateur : il construit le modèle SFINCS du bassin que vous sélectionnez, le vérifie, le lance avec Docker et renvoie les résultats à la page. Tout reste sur votre ordinateur. Ces étapes l’installent sous <b>Windows 10 ou 11</b>. L’installation prend environ une heure, surtout en téléchargements : faites les étapes 2, 3 et 6 avec une bonne connexion internet, si possible avant l’atelier.</>,
  boxes: [
    ['Ordinateur', <>Windows 10 (22H2) ou 11, 64 bits, processeur Intel ou AMD. 8 Go de RAM minimum, 16 Go recommandés. Droits d’administrateur pour installer des logiciels.</>],
    ['Disque et internet', <>15 Go libres. Environ 3 Go à télécharger une seule fois (paquets Python, Docker, image SFINCS), puis 10 à 50 Mo par nouveau bassin.</>],
    ['Fourni par votre formateur', <>Le code (un ZIP du dépôt ou un accès au dépôt) et le paquet de données de l’atelier <code>mdg_pluvial_workshop_data.zip</code> (210 Mo).</>],
  ],
  steps: [
    { title: 'Vérifier l’ordinateur', time: '5 min', body: <>
      <p>Ouvrez le <b>Gestionnaire des tâches</b> (Ctrl+Maj+Échap) → <b>Performance</b> → <b>Processeur</b>. <b>Virtualisation</b> doit indiquer <b>Activé</b> : Docker en a besoin. Si elle est désactivée, il faut l’activer dans le BIOS (demandez à votre support informatique).</p>
      <p>Dans <b>Paramètres → Système → Informations système</b>, vérifiez : système d’exploitation 64 bits, Windows 10 version 22H2 ou Windows 11, et la mémoire RAM installée.</p></> },
    { title: 'Installer Python 3.12', time: '10 min', body: <>
      <p>Téléchargez l’<b>installateur Windows (64 bits)</b> de la dernière version de Python <b>3.12</b> sur <A href="https://www.python.org/downloads/windows/">python.org/downloads/windows</A>. Sur le premier écran de l’installateur, cochez <b>Add python.exe to PATH</b>, puis <b>Install Now</b>.</p>
      <p>Vérification : ouvrez <b>PowerShell</b> (menu Démarrer → tapez PowerShell) et lancez</p>
      <Cmd>py -3.12 --version</Cmd>
      <p>La réponse doit être <code>Python 3.12.x</code>. Utilisez exactement la version 3.12 : la chaîne de traitement a été testée avec elle.</p></> },
    { title: 'Installer Docker Desktop et l’image SFINCS', time: '20–30 min', body: <>
      <p>Téléchargez <b>Docker Desktop for Windows (AMD64)</b> sur <A href="https://www.docker.com/products/docker-desktop/">docker.com</A>, installez-le avec les options par défaut (<b>Use WSL 2</b>) et redémarrez l’ordinateur. Ouvrez Docker Desktop, acceptez les conditions et attendez l’indication <b>Engine running</b>.</p>
      <p>Vérifiez, puis téléchargez le modèle SFINCS (527 Mo) :</p>
      <Cmd>{DOCKER}</Cmd>
      <p>Si votre formateur vous donne l’image sur une clé USB : <code>docker load -i sfincs-v2.4.1.tar</code>.</p>
      <p className="text-ink-3">Docker Desktop est gratuit pour un usage personnel, l’enseignement, les projets open source non commerciaux et les organisations de moins de 250 employés et 10 M USD de chiffre d’affaires ; les organisations plus grandes ont besoin d’un abonnement payant.</p></> },
    { title: 'Placer le code dans un dossier local court', time: '5 min', body: <>
      <p>Créez le dossier <code>C:\mdg</code> et placez-y le code, pour obtenir <code>C:\mdg\pluvial_flood_modelling_madagascar</code> contenant les dossiers <code>scripts</code>, <code>src</code> et <code>config</code>.</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><b>À partir d’un ZIP</b> fourni par votre formateur : clic droit → <b>Extraire tout</b> → <code>C:\mdg</code>.</li>
        <li><b>Avec Git</b>, si vous avez reçu un accès au dépôt : <code>git clone &lt;adresse du dépôt&gt;</code> dans <code>C:\mdg</code>.</li>
      </ul>
      <p>Évitez OneDrive, le Bureau et les Documents s’ils sont synchronisés, ainsi que les chemins longs.</p></> },
    { title: 'Ajouter les données de l’atelier', time: '5 min', body: <>
      <p>Clic droit sur <code>mdg_pluvial_workshop_data.zip</code> → <b>Extraire tout</b> → choisissez le dossier du code <code>C:\mdg\pluvial_flood_modelling_madagascar</code>. Un dossier <code>data</code> apparaît à côté de <code>scripts</code>. Vérifiez que ce fichier existe :</p>
      <Cmd>{EVA}</Cmd>
      <p>Le paquet contient les bassins versants, la série de pluie et les pluies de projet, et les curve numbers pour Madagascar. Le relief et l’occupation du sol sont téléchargés automatiquement pour chaque bassin construit.</p></> },
    { title: 'Créer l’environnement Python', time: '10–20 min', body: <>
      <p>Ouvrez PowerShell dans le dossier du code (dans l’Explorateur de fichiers, ouvrez le dossier, cliquez dans la barre d’adresse, tapez <code>powershell</code>, Entrée). Lancez ces lignes une par une :</p>
      <Cmd>{VENV}</Cmd>
      <p>La troisième ligne télécharge environ 1 Go et prend plusieurs minutes. Puis vérifiez :</p>
      <Cmd>{CHECK}</Cmd>
      <p className="text-ink-3">Installation hors ligne : si votre formateur vous donne un dossier <code>wheels</code>, placez-le dans le dossier du code et remplacez la troisième ligne par <code>.venv\Scripts\python.exe -m pip install --no-index --find-links wheels -r requirements.txt</code>.</p></> },
    { title: 'Lancer le constructeur de modèles', time: '1 min', body: <>
      <p>Double-cliquez sur <code>scripts\start_builder.bat</code> dans le dossier du code (ou lancez <code>.venv\Scripts\python.exe scripts\model_builder_server.py</code> dans PowerShell). Une fenêtre noire s’ouvre et affiche</p>
      <Cmd>{READY}</Cmd>
      <p><b>Gardez cette fenêtre ouverte</b> pendant le travail ; la fermer arrête le constructeur. Si le pare-feu Windows pose la question, vous pouvez cliquer sur <b>Annuler</b> : le constructeur ne communique qu’avec votre propre ordinateur.</p></> },
    { title: 'Connecter cette page', time: '1 min', body: <>
      <p>Ouvrez ce site dans <b>Chrome</b> ou <b>Edge</b>, allez dans <b>Hazard → Model setup</b> et rechargez la page. Quand le navigateur demande l’autorisation d’accéder aux appareils de votre réseau local, cliquez sur <b>Autoriser</b>. En moins de 5 secondes, le panneau ci-dessus affiche <b>Local builder connected</b>.</p></> },
    { title: 'Construire et lancer votre premier modèle', time: '5–15 min', body: <>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Cliquez sur un petit bassin (moins de 100 km²) sur la carte. La carte zoome dessus.</li>
        <li>Gardez <b>Non-cyclone</b>, choisissez une période de retour de <b>10 ans</b> et une résolution de <b>50 m</b>. Le tableau indique la durée de calcul attendue.</li>
        <li>Cliquez sur <b>Generate SFINCS model and check</b>. La première construction d’un bassin télécharge son relief et prend 1 à 6 minutes. Le rapport de contrôle doit indiquer <b>PASS</b>.</li>
        <li>Docker Desktop étant lancé, cliquez sur <b>Run model</b>. À la fin du calcul, la hauteur d’eau apparaît sur la carte avec la surface inondée, les hauteurs et le bilan hydrique.</li>
      </ol>
      <p>La carte des hauteurs d’eau est enregistrée en GeoTIFF dans <code>models\&lt;bassin&gt;\runs\&lt;simulation&gt;\results\</code> et s’ouvre dans QGIS. Les estimations de durée s’ajustent à votre ordinateur après les premières simulations.</p></> },
  ],
  nextTitle: 'Les fois suivantes',
  next: <>Lancez Docker Desktop, double-cliquez sur <code>scripts\start_builder.bat</code>, ouvrez cette page. Les étapes 1 à 6 ne se font qu’une fois.</>,
  troubleTitle: 'En cas de problème',
  trouble: [
    ['La page indique « Local builder not running »', <>Vérifiez que la fenêtre du constructeur est ouverte et affiche <code>{READY}</code>. Autorisez ensuite la page à accéder à votre ordinateur : cliquez sur l’icône à gauche de la barre d’adresse, réglez <b>Accès au réseau local</b> sur <b>Autoriser</b>, puis rechargez. Utilisez Chrome ou Edge.</>],
    ['« port 8765 is already in use »', <>Le constructeur tourne déjà dans une autre fenêtre. Utilisez celle-ci, ou fermez-la et relancez.</>],
    ['« missing input data »', <>Le paquet de données n’est pas au bon endroit. Le dossier <code>data</code> doit se trouver dans le dossier du code, à côté de <code>scripts</code> et <code>src</code> (étape 5).</>],
    ['« py » n’est pas reconnu', <>Python a été installé sans le lanceur ou n’est pas dans le PATH. Réinstallez Python 3.12 en cochant <b>Add python.exe to PATH</b> (étape 2).</>],
    ['pip install échoue ou est très lent', <>Vérifiez la connexion internet (ou le proxy : <code>$env:HTTPS_PROXY="http://proxy:port"</code> dans PowerShell avant pip). Votre formateur peut aussi vous fournir les paquets sur clé USB (installation hors ligne, étape 6).</>],
    ['Docker Desktop ne démarre pas', <>La virtualisation doit être activée (étape 1). S’il demande WSL, ouvrez PowerShell en administrateur, lancez <code>wsl --update</code>, puis redémarrez.</>],
    ['Le bouton Run est grisé', <>Docker Desktop n’est pas lancé (lancez-le et attendez « Engine running »), le modèle n’a pas encore été généré, ou son contrôle qualité a échoué.</>],
    ['La construction échoue pendant un téléchargement', <>Le relief et l’occupation du sol sont téléchargés pour chaque nouveau bassin : gardez l’ordinateur connecté et réessayez. Les fichiers déjà téléchargés sont conservés.</>],
    ['Fichiers verrouillés, erreurs étranges à l’écriture', <>Ne placez pas le dossier du code dans OneDrive, le Bureau ou les Documents s’ils sont synchronisés. Utilisez un chemin local court comme <code>C:\mdg</code>.</>],
  ],
  trainerTitle: 'Pour les formateurs : préparer un atelier',
  trainer: <>
    <p>Sur une machine où la chaîne de traitement fonctionne déjà :</p>
    <ul className="list-disc space-y-1 pl-5">
      <li><b>Paquet de données</b> (environ 210 Mo ; curve numbers découpés sur Madagascar) : <code>python scripts/make_workshop_package.py --out mdg_pluvial_workshop_data.zip</code></li>
      <li><b>Paquets Python pour installation hors ligne</b> (Windows, Python 3.12) : <code>pip download -r requirements.txt -d wheels --platform win_amd64 --python-version 3.12 --only-binary=:all:</code></li>
      <li><b>Image SFINCS sur clé USB</b> : <code>docker save deltares/sfincs-cpu:sfincs-v2.4.1 -o sfincs-v2.4.1.tar</code></li>
      <li><b>Code</b> : le dépôt est privé. Donnez aux participants un accès en lecture, ou un ZIP du dépôt (sans <code>data</code>, <code>models</code> ni <code>outputs</code>).</li>
      <li>Testez toute la séquence à l’avance sur un ordinateur de l’atelier, y compris Docker et l’autorisation du navigateur.</li>
    </ul></>,
}

function Guide({ c }: { c: Content }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">{c.intro}</p>
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        {c.boxes.map(([t, body]) => (
          <div key={t} className="rounded-lg border border-line p-3">
            <div className="font-medium text-ink">{t}</div>
            <div className="text-ink-2">{body}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {c.steps.map((s, i) => <Step key={s.title} n={i + 1} title={s.title} time={s.time}>{s.body}</Step>)}
      </div>
      <div className="rounded-lg border border-line p-3">
        <div className="mb-1 font-medium text-ink">{c.nextTitle}</div>
        <p className="text-sm text-ink-2">{c.next}</p>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">{c.troubleTitle}</h3>
        <table className="w-full text-sm">
          <tbody>
            {c.trouble.map(([q, a]) => (
              <tr key={q} className="border-b border-line align-top last:border-0">
                <td className="w-1/3 py-2 pr-3 font-medium text-ink">{q}</td>
                <td className="py-2 text-ink-2">{a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="rounded-lg border border-line">
        <summary className="cursor-pointer px-3 py-2 font-medium text-ink">{c.trainerTitle}</summary>
        <div className="space-y-2 border-t border-line px-3 py-3 text-sm text-ink-2">{c.trainer}</div>
      </details>
    </div>
  )
}

/** The guide card with its language switch. */
export function SetupGuideCard() {
  const [lang, setLang] = useState<Lang>(() => (navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en'))
  const c = lang === 'fr' ? FR : EN
  return (
    <Card title={c.title} subtitle={c.subtitle}
      actions={<Segmented label="Language / Langue" value={lang} onChange={setLang}
        options={[{ value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }]} />}>
      <div lang={lang}><Guide c={c} /></div>
    </Card>
  )
}
