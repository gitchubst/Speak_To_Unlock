(function() {
    let requiredPhrase = "I'm an addict";
    let requiredLevel = 50;
    let blockedSites = [];
    let recognition;
    let audioContext;
    let analyser;
    let microphone;
    let javascriptNode;
    let settingsOpen = false;
    let audioStream;
    let audioLevel = 0;
    let recognitionSucceeded = false;

    const currentHostname = window.location.hostname.startsWith('www.') ? window.location.hostname.substring(4) : window.location.hostname;

    function createBlockerUI() {
        if (document.getElementById('mindful-blocker-overlay')) {
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'mindful-blocker-overlay';

        const popup = document.createElement('div');
        popup.id = 'mindful-blocker-popup';

        const title = document.createElement('h1');
        title.id = 'mindful-blocker-title';
        title.textContent = 'Speak to Unlock';

        const message = document.createElement('p');
        message.id = 'mindful-blocker-message';
        message.innerHTML = `<span>You can't use this website until you say:</span> <br><strong>${requiredPhrase}</strong>`;

        const status = document.createElement('p');
        status.id = 'mindful-blocker-status';
        status.textContent = 'Click the button and speak';

        const speakButton = document.createElement('button');
        speakButton.id = 'mindful-blocker-speak-button';
        speakButton.textContent = 'Speak';
        speakButton.onclick = startRecognition;

        const settingsButton = document.createElement('button');
        settingsButton.id = 'mindful-blocker-settings-toggle';
        settingsButton.textContent = 'Settings';
        settingsButton.onclick = toggleSettings;

        popup.appendChild(title);
        popup.appendChild(message);
        popup.appendChild(status);
        popup.appendChild(speakButton);
        popup.appendChild(settingsButton);
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (!video.paused) {
                video.pause();
            }
        });

        createSettingsPanel();
    }

    function createSettingsPanel() {
        const settingsPanel = document.createElement('div');
        settingsPanel.id = 'mindful-blocker-settings-panel';

        const settingsTitle = document.createElement('h2');
        settingsTitle.textContent = 'Settings';

        const phraseLabel = document.createElement('label');
        phraseLabel.textContent = 'Required Phrase:';
        const phraseInput = document.createElement('input');
        phraseInput.type = 'text';
        phraseInput.id = 'mindful-blocker-phrase-input';
        phraseInput.value = requiredPhrase;

        const levelLabel = document.createElement('label');
        levelLabel.textContent = `Required Audio Level: ${requiredLevel}`;
        const levelSlider = document.createElement('input');
        levelSlider.type = 'range';
        levelSlider.id = 'mindful-blocker-level-slider';
        levelSlider.min = 0;
        levelSlider.max = 100;
        levelSlider.value = requiredLevel;
        levelSlider.oninput = () => {
            levelLabel.textContent = `Required Audio Level: ${levelSlider.value}`;
        };

        const sitesLabel = document.createElement('label');
        sitesLabel.textContent = 'Blocked Websites:';
        const sitesList = document.createElement('div');
        sitesList.id = 'mindful-blocker-sites-list';

        const newSiteContainer = document.createElement('div');
        newSiteContainer.id = 'mindful-blocker-new-site-container';
        const newSiteInput = document.createElement('input');
        newSiteInput.type = 'text';
        newSiteInput.placeholder = 'e.g., example.com';
        const addSiteButton = document.createElement('button');
        addSiteButton.textContent = 'Add';
        addSiteButton.onclick = () => {
            if (newSiteInput.value) {
                blockedSites.push(newSiteInput.value.trim().toLowerCase());
                newSiteInput.value = '';
                updateSitesList();
                saveSettings();
            }
        };
        newSiteContainer.appendChild(newSiteInput);
        newSiteContainer.appendChild(addSiteButton);


        const saveButton = document.createElement('button');
        saveButton.id = 'mindful-blocker-save-button';
        saveButton.textContent = 'Save and Reload';
        saveButton.onclick = () => {
            requiredPhrase = phraseInput.value;
            requiredLevel = parseInt(levelSlider.value, 10);
            saveSettings(true);
        };

        settingsPanel.appendChild(settingsTitle);
        settingsPanel.appendChild(phraseLabel);
        settingsPanel.appendChild(phraseInput);
        settingsPanel.appendChild(levelLabel);
        settingsPanel.appendChild(levelSlider);
        settingsPanel.appendChild(sitesLabel);
        settingsPanel.appendChild(sitesList);
        settingsPanel.appendChild(newSiteContainer);
        settingsPanel.appendChild(saveButton);

        document.getElementById('mindful-blocker-popup').appendChild(settingsPanel);
        updateSitesList();
    }

    function updateSitesList() {
        const sitesList = document.getElementById('mindful-blocker-sites-list');
        sitesList.innerHTML = '';
        blockedSites.forEach((site, index) => {
            const siteItem = document.createElement('div');
            siteItem.className = 'mindful-blocker-site-item';
            const siteName = document.createElement('span');
            siteName.textContent = site;
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.onclick = () => {
                blockedSites.splice(index, 1);
                updateSitesList();
                saveSettings();
            };
            siteItem.appendChild(siteName);
            siteItem.appendChild(removeButton);
            sitesList.appendChild(siteItem);
        });
    }

    function toggleSettings() {
        const settingsPanel = document.getElementById('mindful-blocker-settings-panel');
        settingsOpen = !settingsOpen;
        settingsPanel.style.display = settingsOpen ? 'flex' : 'none';
    }

    function saveSettings(reload = false) {
        chrome.storage.local.set({
            blockedSites: blockedSites,
            requiredPhrase: requiredPhrase,
            requiredLevel: requiredLevel
        }, () => {
            if (reload) {
                window.location.reload();
            }
        });
    }

    function stopRecognitionAndAudio() {
        if (recognition) {
            recognition.stop();
            recognition = null;
        }
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }
        if (javascriptNode) {
            javascriptNode.disconnect();
            javascriptNode = null;
        }
        if (microphone) {
            microphone.disconnect();
            microphone = null;
        }
    }
    
    function resetSpeakButton() {
        const speakButton = document.getElementById('mindful-blocker-speak-button');
        if (speakButton) {
            speakButton.textContent = 'Speak';
            speakButton.disabled = false;
            speakButton.classList.remove('recording');
        }
    }

    function startRecognition() {
        const status = document.getElementById('mindful-blocker-status');
        const speakButton = document.getElementById('mindful-blocker-speak-button');
        
        recognitionSucceeded = false;
        status.textContent = 'Listening';
        speakButton.textContent = 'Recording';
        speakButton.disabled = true;
        speakButton.classList.add('recording');

        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                audioStream = stream;
                microphone = audioContext.createMediaStreamSource(stream);
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                microphone.connect(analyser);

                javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
                analyser.connect(javascriptNode);
                javascriptNode.connect(audioContext.destination);
                
                javascriptNode.onaudioprocess = function() {
                    const array = new Uint8Array(analyser.frequencyBinCount);
                    analyser.getByteFrequencyData(array);
                    let values = 0;
                    const length = array.length;
                    for (let i = 0; i < length; i++) {
                        values += (array[i]);
                    }
                    audioLevel = Math.round(values / length);
                }

                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.lang = 'en-US';
                recognition.interimResults = false;
                recognition.maxAlternatives = 1;

                recognition.start();

                recognition.onresult = (event) => {
                    const spokenPhrase = event.results[0][0].transcript.trim().toLowerCase();
                    const targetPhrase = requiredPhrase.trim().toLowerCase();
                    
                    stopRecognitionAndAudio();

                    if (spokenPhrase === targetPhrase && audioLevel >= requiredLevel) {
                        recognitionSucceeded = true;
                        status.textContent = 'Success! Unlocking...';
                        unlockPage();
                    } else if (spokenPhrase !== targetPhrase) {
                        status.textContent = `You said: "${spokenPhrase}". Incorrect phrase. Try again.`;
                        resetSpeakButton();
                    } else {
                        status.textContent = `Please speak louder. Your level was ${audioLevel}/${requiredLevel}. Try again.`;
                        resetSpeakButton();
                    }
                };

                recognition.onerror = (event) => {
                    if (event.error === 'no-speech') {
                        status.textContent = 'No speech detected. Please try again.';
                    } else {
                        status.textContent = 'Error: ' + event.error + '. Please try again.';
                    }
                    stopRecognitionAndAudio();
                    resetSpeakButton();
                };

                recognition.onend = () => {
                    stopRecognitionAndAudio();
                    if (!recognitionSucceeded) {
                        if(status.textContent === 'Listening') {
                            status.textContent = 'Click the button and speak.';
                        }
                        resetSpeakButton();
                    }
                };

            }).catch(err => {
                status.textContent = 'Could not access microphone. Please allow access.';
                resetSpeakButton();
            });
        } else {
            status.textContent = 'Speech recognition not supported in this browser.';
            resetSpeakButton();
        }
    }

    function unlockPage() {
        const overlay = document.getElementById('mindful-blocker-overlay');
        if (overlay) {
            overlay.remove();
        }
        document.body.style.overflow = 'auto';
    }

    function init() {
        chrome.storage.local.get(['blockedSites', 'requiredPhrase', 'requiredLevel'], (data) => {
            blockedSites = data.blockedSites || [];
            requiredPhrase = data.requiredPhrase || "I'm an addict";
            requiredLevel = data.requiredLevel || 50;

            if (blockedSites.includes(currentHostname)) {
                createBlockerUI();
            }
        });
    }

    init();
})();
