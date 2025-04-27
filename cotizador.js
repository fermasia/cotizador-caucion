// Funciones adicionales para fechas personalizadas
document.getElementById('periodicity').addEventListener('change', function() {
    const customDaysGroup = document.getElementById('custom-days-group');
    customDaysGroup.style.display = (this.value === 'Personalizada') ? 'block' : 'none';
    markChangesPending();
});

document.getElementById('date-from').addEventListener('change', calculateCustomDays);
document.getElementById('date-to').addEventListener('change', calculateCustomDays);

function calculateCustomDays() {
    const fromDate = document.getElementById('date-from').value;
    const toDate = document.getElementById('date-to').value;
    if (fromDate && toDate) {
        const start = new Date(fromDate);
        const end = new Date(toDate);
        if (end >= start) {
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            document.getElementById('calculated-days').textContent = diffDays;
            markChangesPending();
            return diffDays;
        } else {
            document.getElementById('calculated-days').textContent = '0';
            return 0;
        }
    }
    return 0;
}

// Ajustes en calcular días en calculateQuote y notaryCost
// Cotizador de Seguros de Caución - JavaScript
// Este script maneja toda la lógica del cotizador, incluyendo cálculos, validaciones y visualizaciones

// Variables globales
let cotizadorData = {
    companias: [
        {
            nombre: "Compañía A",
            prima_minima: {
                ARS: 1000,
                USD: 50,
                EUR: 50
            },
            derecho_emision: {
                ARS: 500,
                USD: 20,
                EUR: 20
            },
            impuesto_pais: 10,
            recargo_administrativo: 5,
            escribano_solo: {
                ARS: 300,
                USD: 15,
                EUR: 15
            },
            escribano_colegio: {
                ARS: 500,
                USD: 25,
                EUR: 25
            }
        },
        {
            nombre: "Compañía B",
            prima_minima: {
                ARS: 1200,
                USD: 60,
                EUR: 60
            },
            derecho_emision: {
                ARS: 600,
                USD: 25,
                EUR: 25
            },
            impuesto_pais: 12,
            recargo_administrativo: 6,
            escribano_solo: {
                ARS: 350,
                USD: 18,
                EUR: 18
            },
            escribano_colegio: {
                ARS: 550,
                USD: 28,
                EUR: 28
            }
        },
        {
            nombre: "Compañía C",
            prima_minima: {
                ARS: 1100,
                USD: 55,
                EUR: 55
            },
            derecho_emision: {
                ARS: 550,
                USD: 22,
                EUR: 22
            },
            impuesto_pais: 11,
            recargo_administrativo: 5.5,
            escribano_solo: {
                ARS: 320,
                USD: 16,
                EUR: 16
            },
            escribano_colegio: {
                ARS: 520,
                USD: 26,
                EUR: 26
            }
        },
        {
            nombre: "Compañía D",
            prima_minima: {
                ARS: 1300,
                USD: 65,
                EUR: 65
            },
            derecho_emision: {
                ARS: 650,
                USD: 26,
                EUR: 26
            },
            impuesto_pais: 13,
            recargo_administrativo: 6.5,
            escribano_solo: {
                ARS: 370,
                USD: 19,
                EUR: 19
            },
            escribano_colegio: {
                ARS: 570,
                USD: 29,
                EUR: 29
            }
        }
    ],
    impuestos: {
        intereses_internos: 0.1,
        tasa_ssn: 0.6,
        osseg: 0.5,
        iva: 21
    },
    periodicidad: {
        Mensual: 30,
        Trimestral: 90,
        Semestral: 180,
        Anual: 365
    }
}; // Datos predeterminados en caso de que falle la carga del JSON
let changesPending = false; // Indica si hay cambios pendientes de calcular

// Datos de sellados por jurisdicción
const alicuotas_impuesto_sellos = {
    "Buenos Aires": 1.00,
    "Ciudad Autónoma de Buenos Aires": 1.00,
    "Catamarca": 0.60,
    "Chaco": 0.50,
    "Chubut": 1.20,
    "Córdoba": 1.00,
    "Corrientes": 1.00,
    "Entre Ríos": 1.00,
    "Formosa": 1.00,
    "Jujuy": 1.00,
    "La Pampa": 1.00,
    "La Rioja": 2.00,
    "Mendoza": 1.50,
    "Misiones": 1.50,
    "Neuquén": 1.50,
    "Río Negro": 1.00,
    "Salta": 0.60,
    "San Juan": 1.74,
    "San Luis": 1.20,
    "Santa Cruz": 1.00,
    "Santa Fe": 0.50,
    "Santiago del Estero": 3.00,
    "Tierra del Fuego": 1.00,
    "Tucumán": 1.00
};

// Agregar sellados a cotizadorData
if (!cotizadorData.sellados) {
    cotizadorData.sellados = alicuotas_impuesto_sellos;
}

// Inicializar el cotizador cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    // Intentar cargar los datos del archivo JSON
    loadCotizadorData();
    
    // Inicializar eventos
    initializeEvents();
    
    // Inicializar el editor de compañías
    initializeCompanyEditor();

    // Inicializar el editor de impuestos
    initializeTaxEditor();

    // Cargar las jurisdicciones en el selector
    loadJurisdictionsIntoSelector();

    // Ocultar por defecto y cuando es ARS
    const exchangeRateContainer = document.getElementById('exchange-rate-container');
    exchangeRateContainer.classList.remove('visible');
});

// Cargar los datos del cotizador desde el archivo JSON
async function loadCotizadorData() {
    try {
        const response = await fetch('datos_cotizador.json');
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        const data = await response.json();
        
        // Verificar que los datos tengan la estructura correcta
        if (data && data.companias && data.impuestos && data.periodicidad) {
            cotizadorData = data;
            console.log('Datos del cotizador cargados correctamente desde JSON');
        } else {
            console.warn('Estructura de datos incorrecta en el archivo JSON, usando datos predeterminados');
        }
    } catch (error) {
        console.warn('Error al cargar los datos del cotizador desde JSON, usando datos predeterminados:', error);
    }
    
    // Cargar las compañías en el selector
    loadCompaniesIntoSelector();
}

// Cargar las compañías en el selector
function loadCompaniesIntoSelector() {
    const companySelect = document.getElementById('company');
    
    // Limpiar opciones existentes
    companySelect.innerHTML = '<option value="">Seleccione una compañía</option>';
    
    // Agregar las compañías
    cotizadorData.companias.forEach(compania => {
        const option = document.createElement('option');
        option.value = compania.nombre;
        option.textContent = compania.nombre;
        companySelect.appendChild(option);
    });
}

// Inicializar eventos de la interfaz
function initializeEvents() {
    // Evento para mostrar/ocultar el campo de días personalizados
    document.getElementById('periodicity').addEventListener('change', function() {
        const customDaysGroup = document.getElementById('custom-days-group');
        if (this.value === 'Personalizada') {
            customDaysGroup.style.display = 'block';
        } else {
            customDaysGroup.style.display = 'none';
        }
        markChangesPending();
    });
    
    // Eventos para marcar cambios pendientes
    const inputElements = document.querySelectorAll('input, select');
    inputElements.forEach(element => {
        element.addEventListener('change', markChangesPending);
        if (element.type === 'number' || element.type === 'text') {
            element.addEventListener('input', markChangesPending);
        }
    });
    
    // Evento para el botón de calcular
    document.getElementById('calculate-btn').addEventListener('click', function() {
        if (calculateQuote()) {
            clearChangesPending();
        }
    });
    
    // Evento para el botón de exportar a PDF
    document.getElementById('export-pdf-btn').addEventListener('click', exportToPDF);
    
    // Evento para el selector de moneda
    document.getElementById('currency').addEventListener('change', async function() {
        await toggleExchangeRate();
        initializeFields();
        markChangesPending();
    });
    
    // Evento para el selector de compañía
    document.getElementById('company').addEventListener('change', function() {
        initializeFields();
        markChangesPending();
    });
    
    // Evento para el campo de tipo de cambio
    document.getElementById('exchange-rate').addEventListener('input', function() {
        const value = parseFloat(this.value);
        const container = document.getElementById('exchange-rate-container');
        if (value && !isNaN(value) && value > 0) {
            container.classList.remove('warning');
            initializeEmissionRight();
        } else {
            container.classList.add('warning');
        }
        markChangesPending();
    });
    
    // Evento para el botón de editar compañías
    document.getElementById('edit-companies-btn').addEventListener('click', openCompaniesModal);
    
    // Evento para cerrar el modal de compañías
    document.getElementById('close-companies-modal').addEventListener('click', closeCompaniesModal);
    
    // Evento para el botón de agregar nueva compañía
    document.getElementById('add-company-btn').addEventListener('click', addNewCompany);
    
    // Evento para el botón de guardar cambios de compañías
    document.getElementById('save-companies-btn').addEventListener('click', saveCompaniesChanges);
    
    // Cerrar el modal si se hace clic fuera de él
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('companies-modal');
        if (event.target === modal) {
            closeCompaniesModal();
        }
    });

    // Evento para el selector de jurisdicción
    document.getElementById('jurisdiction').addEventListener('change', function() {
        const jurisdiccion = this.value;
        if (jurisdiccion && cotizadorData.sellados[jurisdiccion]) {
            document.getElementById('stamps-percentage').value = cotizadorData.sellados[jurisdiccion];
        }
        markChangesPending();
    });

    // Evento para el selector de tipo de escribanía
    document.getElementById('notary-type').addEventListener('change', function() {
        initializeFields();
        markChangesPending();
    });
}

// Marcar que hay cambios pendientes de calcular
function markChangesPending() {
    changesPending = true;
    document.getElementById('changes-pending').style.display = 'block';
    const calculateButton = document.getElementById('calculate-btn');
    if (calculateButton) {
        calculateButton.classList.add('has-changes');
    }
}

// Ocultar el indicador de cambios pendientes
function clearChangesPending() {
    changesPending = false;
    document.getElementById('changes-pending').style.display = 'none';
    const calculateButton = document.getElementById('calculate-btn');
    if (calculateButton) {
        calculateButton.classList.remove('has-changes');
    }
}

// Función para inicializar el derecho de emisión
function initializeEmissionRight() {
    const company = document.getElementById('company').value;
    const currency = document.getElementById('currency').value;
    const exchangeRateInput = document.getElementById('exchange-rate');
    const exchangeRateContainer = document.getElementById('exchange-rate-container');
    
    if (company && currency) {
        const selectedCompany = cotizadorData.companias.find(c => c.nombre === company);
        if (selectedCompany) {
            if (currency === 'ARS') {
                document.getElementById('emission-right').value = selectedCompany.derecho_emision[currency];
                exchangeRateContainer.classList.remove('warning');
            } else {
                // Para USD y EUR, usar el valor en ARS dividido por el tipo de cambio
                const exchangeRate = parseFloat(exchangeRateInput.value);
                const arsValue = selectedCompany.derecho_emision['ARS'];
                
                if (!exchangeRate || isNaN(exchangeRate) || exchangeRate <= 0) {
                    exchangeRateContainer.classList.add('warning');
                    document.getElementById('emission-right').value = '';
                } else {
                    exchangeRateContainer.classList.remove('warning');
                    document.getElementById('emission-right').value = (arsValue / exchangeRate).toFixed(2);
                }
            }
        }
    }
}

// Función para mostrar/ocultar el campo de tipo de cambio
async function toggleExchangeRate() {
    const currency = document.getElementById('currency').value;
    const exchangeRateContainer = document.getElementById('exchange-rate-container');
    const exchangeRateInput = document.getElementById('exchange-rate');
    
    // Ocultar por defecto y cuando es ARS
    if (!currency || currency === 'ARS') {
        exchangeRateContainer.classList.remove('visible', 'warning');
        exchangeRateInput.removeAttribute('required');
        exchangeRateInput.value = '';
        document.getElementById('exchange-rate-error').style.display = 'none';
        return;
    }
    
    // Solo mostrar para USD y EUR
    exchangeRateContainer.classList.add('visible');
    exchangeRateInput.setAttribute('required', 'required');
    
    // Obtener el tipo de cambio según la moneda seleccionada
    if (currency === 'USD' || currency === 'EUR') {
        try {
            console.log(`Obteniendo tipo de cambio para ${currency} desde BNA...`);
            
            const response = await fetch('https://r.jina.ai/https://www.bna.com.ar/Personas', {
                headers: {
                    'Authorization': 'Bearer jina_25ee900d2acf4a7cbb1110305f362af4xgQE8x4yHrkGItAAICF9rGobrQ1F',
                    'X-Return-Format': 'markdown'
                }
            });
            
            if (response.ok) {
                const markdown = await response.text();
                console.log('Respuesta markdown recibida:', markdown);
                
                // Definir el patrón según la moneda
                let currencyPattern;
                if (currency === 'USD') {
                    currencyPattern = /\| Dolar U\.S\.A \| \d+,\d+ \| (\d+,\d+) \|/;
                    console.log('Buscando patrón USD en el markdown');
                } else {
                    currencyPattern = /\| Euro \| \d+,\d+ \| (\d+,\d+) \|/;
                    console.log('Buscando patrón EUR en el markdown');
                }
                
                const match = markdown.match(currencyPattern);
                if (match && match[1]) {
                    console.log(`Valor encontrado para ${currency}:`, match[1]);
                    // Convertir el valor de formato "1.234,56" a "1234.56"
                    const exchangeRate = parseFloat(match[1].replace('.', '').replace(',', '.'));
                    console.log(`Tipo de cambio convertido:`, exchangeRate);
                    
                    if (!isNaN(exchangeRate) && exchangeRate > 0) {
                        exchangeRateInput.value = exchangeRate;
                        exchangeRateContainer.classList.remove('warning');
                        console.log(`Tipo de cambio establecido para ${currency}:`, exchangeRate);
                    } else {
                        console.error(`Error: valor de tipo de cambio inválido para ${currency}`);
                        exchangeRateInput.value = '';
                        exchangeRateContainer.classList.add('warning');
                    }
                } else {
                    console.error(`No se encontró el patrón para ${currency} en el markdown`);
                    exchangeRateInput.value = '';
                    exchangeRateContainer.classList.add('warning');
                }
            } else {
                console.error('Error en la respuesta de la API:', response.status);
                exchangeRateInput.value = '';
                exchangeRateContainer.classList.add('warning');
            }
        } catch (error) {
            console.error(`Error al obtener el tipo de cambio para ${currency}:`, error);
            exchangeRateInput.value = '';
            exchangeRateContainer.classList.add('warning');
        }
    }
    
    // Mostrar advertencia si no hay valor válido
    if (!exchangeRateInput.value || isNaN(exchangeRateInput.value) || parseFloat(exchangeRateInput.value) <= 0) {
        exchangeRateContainer.classList.add('warning');
    } else {
        exchangeRateContainer.classList.remove('warning');
    }
}

// Validar el formulario
function validateForm() {
    let isValid = true;
    
    // Validar compañía
    const company = document.getElementById('company').value;
    if (!company) {
        document.getElementById('company-error').style.display = 'block';
        isValid = false;
    } else {
        document.getElementById('company-error').style.display = 'none';
    }
    
    // Validar moneda
    const currency = document.getElementById('currency').value;
    if (!currency) {
        document.getElementById('currency-error').style.display = 'block';
        isValid = false;
    } else {
        document.getElementById('currency-error').style.display = 'none';
        
        // Validar tipo de cambio si la moneda no es ARS
        if (currency !== 'ARS') {
            const exchangeRate = document.getElementById('exchange-rate').value;
            if (!exchangeRate || isNaN(exchangeRate) || parseFloat(exchangeRate) <= 0) {
                document.getElementById('exchange-rate-error').style.display = 'block';
                isValid = false;
            } else {
                document.getElementById('exchange-rate-error').style.display = 'none';
            }
        }
    }
    
    // Validar suma asegurada
    const insuredAmount = document.getElementById('insured-amount').value;
    if (!insuredAmount || isNaN(insuredAmount) || parseFloat(insuredAmount) <= 0) {
        document.getElementById('insured-amount-error').style.display = 'block';
        isValid = false;
    } else {
        document.getElementById('insured-amount-error').style.display = 'none';
    }
    
    // Validar periodicidad
    const periodicity = document.getElementById('periodicity').value;
    if (!periodicity) {
        document.getElementById('periodicity-error').style.display = 'block';
        isValid = false;
    } else {
        document.getElementById('periodicity-error').style.display = 'none';
    }
    
    // Validar días personalizados si corresponde
    if (periodicity === 'Custom') {
        const customDays = document.getElementById('custom-days').value;
        if (!customDays || isNaN(customDays) || parseInt(customDays) <= 0) {
            document.getElementById('custom-days-error').style.display = 'block';
            isValid = false;
        } else {
            document.getElementById('custom-days-error').style.display = 'none';
        }
    }
    
    // Validar tasa anual
    const annualRate = document.getElementById('annual-rate').value;
    if (!annualRate || isNaN(annualRate) || parseFloat(annualRate) <= 0) {
        document.getElementById('annual-rate-error').style.display = 'block';
        isValid = false;
    } else {
        document.getElementById('annual-rate-error').style.display = 'none';
    }
    
    // Validar tipo de escribanía
    const notaryType = document.getElementById('notary-type').value;
    if (!notaryType) {
        document.getElementById('notary-type-error').style.display = 'block';
        isValid = false;
    } else {
        document.getElementById('notary-type-error').style.display = 'none';
    }
    
    return isValid;
}

// Calcular la cotización
function calculateQuote() {
    if (!validateForm()) {
        return;
    }
    
    // Obtener los valores del formulario
    const company = document.getElementById('company').value;
    const currency = document.getElementById('currency').value;
    const exchangeRate = currency !== 'ARS' ? parseFloat(document.getElementById('exchange-rate').value) : 1;
    const insuredAmount = parseFloat(document.getElementById('insured-amount').value);
    const periodicity = document.getElementById('periodicity').value;
    const annualRate = parseFloat(document.getElementById('annual-rate').value) / 100;
    const notaryType = document.getElementById('notary-type').value;
    
    // Obtener los días según la periodicidad
    let days;
    if (periodicity === 'Personalizada') {
        days = calculateCustomDays();
        if(days <= 0){
            document.getElementById('custom-days-error').style.display = 'block';
            return;
        } else {
            document.getElementById('custom-days-error').style.display = 'none';
        }
    } else {
        days = cotizadorData.periodicidad[periodicity];
    }
    
    // Encontrar la compañía seleccionada
    const selectedCompany = cotizadorData.companias.find(c => c.nombre === company);
    
    // Calcular la prima
    let premium = insuredAmount * annualRate * days / 365;
    let isMinimumPremiumApplied = false;
    
    // Calcular la prima mínima según la moneda
    let minimumPremium;
    if (currency === 'ARS') {
        minimumPremium = selectedCompany.prima_minima[currency];
    } else {
        minimumPremium = selectedCompany.prima_minima['ARS'] / exchangeRate;
    }
    
    if (premium < minimumPremium) {
        premium = minimumPremium;
        isMinimumPremiumApplied = true;
    }
    
    // Obtener los valores de los campos de edición
    const emissionRightValue = parseFloat(document.getElementById('emission-right-value').value) || 0;
    const notaryValue = parseFloat(document.getElementById('notary-value').value) || 0;
    const countryTaxPercentage = parseFloat(document.getElementById('country-tax-percentage').value) || 0;
    const administrativeSurchargePercentage = parseFloat(document.getElementById('administrative-surcharge-percentage').value) || 0;
    const internalInterestPercentage = parseFloat(document.getElementById('internal-interest-percentage').value) || 0;
    const ssnRatePercentage = parseFloat(document.getElementById('ssn-rate-percentage').value) || 0;
    const ossegPercentage = parseFloat(document.getElementById('osseg-percentage').value) || 0;
    const stampsPercentage = parseFloat(document.getElementById('stamps-percentage').value) || 0;
    const vatPercentage = parseFloat(document.getElementById('vat-percentage').value) || 0;
    
    // Calcular los valores basados en porcentajes
    const emissionRight = emissionRightValue;
    const notaryCost = notaryValue;
    const countryTax = premium * countryTaxPercentage / 100;
    const administrativeSurchargeAmount = premium * administrativeSurchargePercentage / 100;
    
    // Calcular el subtotal
    const subtotal = premium + emissionRight + notaryCost + countryTax + administrativeSurchargeAmount;
    
    // Calcular los impuestos
    const internalInterest = subtotal * internalInterestPercentage / 100;
    const ssnRate = subtotal * ssnRatePercentage / 100;
    const osseg = subtotal * ossegPercentage / 100;
    const stamps = subtotal * stampsPercentage / 100;
    const vat = subtotal * vatPercentage / 100;
    
    // Calcular el total de impuestos
    const totalTaxes = internalInterest + ssnRate + osseg + stamps + vat;
    
    // Calcular el premio final
    const finalPrize = subtotal + totalTaxes;
    
    // Mostrar los resultados
    if (isMinimumPremiumApplied) {
        document.getElementById('premium-result').innerHTML = '<span style="color: var(--warning-color); font-size: 0.8rem;">(Prima Mínima)</span> ' + formatCurrency(premium, currency);
    } else {
        document.getElementById('premium-result').textContent = formatCurrency(premium, currency);
    }
    document.getElementById('emission-right-result').textContent = formatCurrency(emissionRight, currency);
    document.getElementById('notary-result').textContent = formatCurrency(notaryCost, currency);
    document.getElementById('country-tax-result').textContent = formatCurrency(countryTax, currency);
    document.getElementById('administrative-surcharge-result').textContent = formatCurrency(administrativeSurchargeAmount, currency);
    document.getElementById('subtotal-result').textContent = formatCurrency(subtotal, currency);
    document.getElementById('internal-interest-result').textContent = formatCurrency(internalInterest, currency);
    document.getElementById('ssn-rate-result').textContent = formatCurrency(ssnRate, currency);
    document.getElementById('osseg-result').textContent = formatCurrency(osseg, currency);
    document.getElementById('stamps-result').textContent = formatCurrency(stamps, currency);
    document.getElementById('vat-result').textContent = formatCurrency(vat, currency);
    document.getElementById('total-taxes-result').textContent = formatCurrency(totalTaxes, currency);
    document.getElementById('final-prize-result').textContent = formatCurrency(finalPrize, currency);
    
    // Guardar los resultados para posible exportación a PDF
    const quoteResults = {
        company,
        notaryType,
        currency,
        premium,
        subtotal,
        totalTaxes,
        finalPrize,
        insuredAmount,
        periodicity,
        days,
        annualRate: annualRate * 100,
        emissionRight,
        notaryCost,
        countryTax,
        administrativeSurchargeAmount,
        internalInterest,
        ssnRate,
        osseg,
        stamps,
        vat,
        countryTaxPercentage,
        administrativeSurchargePercentage,
        internalInterestPercentage,
        ssnRatePercentage,
        ossegPercentage,
        stampsPercentage,
        vatPercentage
    };
    
    // Guardar los resultados en sessionStorage
    sessionStorage.setItem('currentQuote', JSON.stringify(quoteResults));
    
    // Limpiar el indicador de cambios pendientes
    clearChangesPending();
    
    if (currency !== 'ARS') {
        sessionStorage.setItem('exchangeRate', exchangeRate);
    } else {
        sessionStorage.removeItem('exchangeRate');
    }
    
    return quoteResults;
}

// Exportar a PDF
async function exportToPDF() {
    const currentQuoteStr = sessionStorage.getItem('currentQuote');
    if (!currentQuoteStr) {
        alert('Debe calcular una cotización antes de exportar a PDF');
        return;
    }
    
    const currentQuote = JSON.parse(currentQuoteStr);
    
    // Crear el PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    // Configurar fuentes y colores
    const primaryColor = [30, 53, 100];
    const secondaryColor = [128, 128, 128];
    const accentColor = [15, 27, 50];

    // Detectar si estamos en mobile
    const isMobile = window.innerWidth <= 768;
    const logoSize = isMobile ? { width: 35, height: 14 } : { width: 50, height: 20 };
    const fontSize = isMobile ? { title: 16, subtitle: 10, text: 8 } : { title: 24, subtitle: 12, text: 10 };
    const margins = isMobile ? {
        top: 10,
        logo: { x: 10, y: 10 },
        title: { y: 35 },
        content: { start: 45 }
    } : {
        top: 20,
        logo: { x: 20, y: 15 },
        title: { y: 30 },
        content: { start: 45 }
    };

    try {
        // Agregar logo
        const img = document.querySelector('.logo-container img');
        if (img && img.complete) {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                ctx.drawImage(img, 0, 0);
                const imgData = canvas.toDataURL('image/png');
                doc.addImage(imgData, 'PNG', margins.logo.x, margins.logo.y, logoSize.width, logoSize.height);
            } catch (e) {
                console.warn('No se pudo agregar el logo:', e);
            }
        }
    } catch (e) {
        console.warn('Error al procesar el logo:', e);
    }

    // Título del documento
    doc.setFontSize(fontSize.title);
    doc.setTextColor(...primaryColor);
    doc.text('COTIZACIÓN DE SEGURO DE CAUCIÓN', 105, margins.title.y, { align: 'center' });
    
    // Línea decorativa
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(margins.logo.x, margins.title.y + 5, 190, margins.title.y + 5);

    // Información del documento
    doc.setFontSize(fontSize.text);
    doc.setTextColor(...secondaryColor);
    const today = new Date();
    doc.text(`Fecha de emisión: ${today.toLocaleDateString()}`, margins.logo.x, margins.content.start);
    doc.text(`Cotización N°: ${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`, margins.logo.x, margins.content.start + 5);
    
    // Datos principales de la cotización
    doc.setFontSize(fontSize.subtitle);
    doc.setTextColor(...accentColor);
    doc.text('DATOS DE LA COTIZACIÓN', margins.logo.x, margins.content.start + 20);

    // Línea separadora
    doc.setDrawColor(...secondaryColor);
    doc.setLineWidth(0.2);
    doc.line(margins.logo.x, margins.content.start + 23, 190, margins.content.start + 23);

    // Detalles de la cotización
    const currency = currentQuote.currency;
    const exchangeRate = sessionStorage.getItem('exchangeRate');
    
    const mainData = [
        ['Compañía:', currentQuote.company, 'Moneda:', currency + (currency !== 'ARS' ? ` (TC: ${exchangeRate})` : '')],
        ['Suma Asegurada:', formatCurrency(currentQuote.insuredAmount, currency), 'Jurisdicción:', document.getElementById('jurisdiction').value],
        ['Periodicidad:', `${currentQuote.periodicity} (${currentQuote.days} días)`, 'Tasa Anual:', `${currentQuote.annualRate.toFixed(2)}%`],
        ['Tipo de Certificación:', currentQuote.notaryType, 'Recargo Adm.:', `${currentQuote.administrativeSurchargeAmount.toFixed(2)}%`]
    ];
    
    doc.setFontSize(fontSize.text);
    let y = margins.content.start + 30;
    const colWidth = isMobile ? 40 : 50;
    
    mainData.forEach(row => {
        doc.setTextColor(...secondaryColor);
        doc.text(row[0], margins.logo.x, y);
        doc.setTextColor(...accentColor);
        doc.text(row[1], margins.logo.x + colWidth, y, { maxWidth: 40 });
        doc.setTextColor(...secondaryColor);
        doc.text(row[2], 110, y);
        doc.setTextColor(...accentColor);
        doc.text(row[3], 110 + colWidth, y, { maxWidth: 40 });
        y += 8;
    });
    
    // Título de la sección de resultados
    y += 10;
    doc.setFontSize(fontSize.subtitle);
    doc.setTextColor(...accentColor);
    doc.text('DETALLE DE COSTOS', margins.logo.x, y);
    
    // Línea separadora
    doc.setDrawColor(...secondaryColor);
    doc.line(margins.logo.x, y + 3, 190, y + 3);
    
    // Tabla de resultados con ajustes para mobile
    y += 10;
    const resultData = [
        ['CONCEPTO', 'MONTO'],
        ['Prima', formatCurrency(currentQuote.premium, currentQuote.currency)],
        ['Derecho de Emisión', formatCurrency(currentQuote.emissionRight, currentQuote.currency)],
        ['Certificación', formatCurrency(currentQuote.notaryCost, currentQuote.currency)],
        ['Impuesto País', formatCurrency(currentQuote.countryTax, currentQuote.currency)],
        ['Recargo Administrativo', formatCurrency(currentQuote.administrativeSurchargeAmount, currentQuote.currency)],
        ['Subtotal', formatCurrency(currentQuote.subtotal, currentQuote.currency)],
        ['Intereses Internos', formatCurrency(currentQuote.internalInterest, currentQuote.currency)],
        ['Tasa SSN', formatCurrency(currentQuote.ssnRate, currentQuote.currency)],
        ['OSSEG', formatCurrency(currentQuote.osseg, currentQuote.currency)],
        ['Sellos', formatCurrency(currentQuote.stamps, currentQuote.currency)],
        ['IVA', formatCurrency(currentQuote.vat, currentQuote.currency)],
        ['Total Impuestos', formatCurrency(currentQuote.totalTaxes, currentQuote.currency)],
        ['PREMIO FINAL', formatCurrency(currentQuote.finalPrize, currentQuote.currency)]
    ];
    
    doc.autoTable({
        startY: y,
        head: [resultData[0]],
        body: resultData.slice(1),
        theme: 'grid',
        headStyles: {
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontSize: isMobile ? 9 : 11,
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { cellWidth: isMobile ? 80 : 100 },
            1: { cellWidth: isMobile ? 50 : 70, halign: 'right' }
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245]
        },
        bodyStyles: {
            fontSize: isMobile ? 8 : 10,
            textColor: accentColor
        },
        styles: {
            cellPadding: isMobile ? 3 : 5,
            fontSize: isMobile ? 8 : 10,
            valign: 'middle'
        },
        margin: { left: 20 }
    });
    
    // Pie de página
    const finalY = doc.lastAutoTable.finalY + (isMobile ? 15 : 20);
    doc.setFontSize(isMobile ? 7 : 8);
    doc.setTextColor(...secondaryColor);
    doc.text('IMPORTANTE:', margins.logo.x, finalY);
    doc.text('• Esta cotización tiene una validez de 7 días a partir de su fecha de emisión.', margins.logo.x, finalY + 4);
    doc.text('• Los valores expresados están sujetos a modificaciones según condiciones específicas de la póliza.', margins.logo.x, finalY + 8);
    doc.text('• La presente cotización no implica aceptación del riesgo ni compromiso de emisión por parte de la compañía.', margins.logo.x, finalY + 12);

    // Agregar datos de contacto
    doc.setFontSize(isMobile ? 8 : 9);
    doc.setTextColor(...primaryColor);
    doc.text('SIRIUS BROKER DE SEGUROS', 105, finalY + 25, { align: 'center' });
    doc.setFontSize(isMobile ? 7 : 8);
    doc.setTextColor(...secondaryColor);
    doc.text('Tel: (011) 4444-4444 | Email: contacto@sirius.com.ar', 105, finalY + 30, { align: 'center' });
    doc.text('www.sirius.com.ar', 105, finalY + 35, { align: 'center' });

    // Agregar número de página
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(isMobile ? 7 : 8);
        doc.setTextColor(...secondaryColor);
        doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
    }
    
    // Guardar el PDF
    doc.save(`Cotizacion_${currentQuote.company}_${today.toISOString().split('T')[0]}.pdf`);
}

// Formatear moneda
function formatCurrency(amount, currency) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// Funciones para el editor de compañías

// Inicializar el editor de compañías
function initializeCompanyEditor() {
    // Generar la tabla de compañías inicialmente
    generateCompaniesTable();
    
    // Agregar evento para el botón de guardar
    const saveButton = document.getElementById('save-companies-btn');
    if (saveButton) {
        saveButton.addEventListener('click', saveCompaniesChanges);
    }
}

// Abrir el modal de edición de compañías
function openCompaniesModal() {
    // Generar la tabla de compañías
    generateCompaniesTable();
    
    // Asegurar que el botón de guardar no tenga la clase has-changes al abrir
    const saveButton = document.getElementById('save-companies-btn');
    if (saveButton) {
        saveButton.classList.remove('has-changes');
    }
    
    // Mostrar el modal
    document.getElementById('companies-modal').style.display = 'block';
}

// Cerrar el modal de edición de compañías
function closeCompaniesModal() {
    document.getElementById('companies-modal').style.display = 'none';
}

// Generar la tabla de compañías
function generateCompaniesTable() {
    const tableContainer = document.querySelector('.companies-table-container');
    
    let tableHTML = `
        <table class="companies-table">
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>Impuesto País (%)</th>
                    <th>Recargo Adm. (%)</th>
                    <th>Moneda</th>
                    <th class="value-column">Prima Mínima</th>
                    <th class="value-column">Derecho de Emisión</th>
                    <th class="value-column">Escribano</th>
                    <th class="value-column">Escribano + Colegio</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    cotizadorData.companias.forEach((compania, index) => {
        tableHTML += `
            <tr>
                <td>
                    <input type="text" class="company-name-input" value="${compania.nombre}" 
                           onchange="updateCompanyName(${index}, this.value)">
                </td>
                <td><input type="number" step="0.01" value="${compania.impuesto_pais}" data-field="impuesto_pais" onchange="updateCompanyData(${index}, 'impuesto_pais', this.value)"></td>
                <td><input type="number" step="0.01" value="${compania.recargo_administrativo}" data-field="recargo_administrativo" onchange="updateCompanyData(${index}, 'recargo_administrativo', this.value)"></td>
                <td class="currency-cell">ARS</td>
                <td class="value-column"><input type="number" step="0.01" value="${compania.prima_minima.ARS}" data-field="prima_minima" onchange="updateCompanyData(${index}, 'prima_minima', this.value, 'ARS')"></td>
                <td class="value-column"><input type="number" step="0.01" value="${compania.derecho_emision.ARS}" data-field="derecho_emision" onchange="updateCompanyData(${index}, 'derecho_emision', this.value, 'ARS')"></td>
                <td class="value-column"><input type="number" step="0.01" value="${compania.escribano_solo.ARS}" data-field="escribano_solo" onchange="updateCompanyData(${index}, 'escribano_solo', this.value, 'ARS')"></td>
                <td class="value-column"><input type="number" step="0.01" value="${compania.escribano_colegio.ARS}" data-field="escribano_colegio" onchange="updateCompanyData(${index}, 'escribano_colegio', this.value, 'ARS')"></td>
                <td class="actions-cell">
                    <button class="btn-remove-company" onclick="removeCompany(${index})">Eliminar</button>
                </td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    tableContainer.innerHTML = tableHTML;
    
    // Actualizar el estado del botón de guardar si hay cambios pendientes
    const saveButton = document.getElementById('save-companies-btn');
    if (saveButton && changesPending) {
        saveButton.classList.add('has-changes');
    }
}

function addNewCompany() {
    const newCompany = {
        nombre: `Nueva Compañía ${cotizadorData.companias.length + 1}`,
        prima_minima: {
            ARS: 1000,
            USD: 50,
            EUR: 50
        },
        derecho_emision: {
            ARS: 500,
            USD: 20,
            EUR: 20
        },
        impuesto_pais: 10,
        recargo_administrativo: 5,
        escribano_solo: {
            ARS: 300,
            USD: 15,
            EUR: 15
        },
        escribano_colegio: {
            ARS: 500,
            USD: 25,
            EUR: 25
        }
    };
    
    cotizadorData.companias.push(newCompany);
    generateCompaniesTable();
    markChangesPending();
}

function updateCompanyData(companyIndex, field, value, currency = null) {
    try {
        // Validar que el índice de la compañía sea válido
        if (companyIndex < 0 || companyIndex >= cotizadorData.companias.length) {
            throw new Error('Índice de compañía inválido');
        }

        // Convertir el valor a número y validar
        const numericValue = parseFloat(value);
        if (isNaN(numericValue)) {
            throw new Error('El valor debe ser un número válido');
        }

        // Actualizar el valor según el campo y la moneda
        if (currency) {
            // Para campos que tienen valores por moneda (prima_minima, derecho_emision, etc.)
            if (!cotizadorData.companias[companyIndex][field]) {
                cotizadorData.companias[companyIndex][field] = { ARS: 0, USD: 0, EUR: 0 };
            }
            cotizadorData.companias[companyIndex][field][currency] = numericValue;
        } else {
            // Para campos simples (impuesto_pais, recargo_administrativo)
            cotizadorData.companias[companyIndex][field] = numericValue;
        }

        // Marcar que hay cambios pendientes
        markChangesPending();

        // Actualizar la interfaz
        const saveButton = document.getElementById('save-companies-btn');
        if (saveButton) {
            saveButton.classList.add('has-changes');
        }
    } catch (error) {
        console.error('Error al actualizar datos de compañía:', error);
        alert('Error al actualizar el valor. Por favor, verifique que sea un número válido.');
    }
}

// Eliminar una compañía
function removeCompany(index) {
    // Confirmar la eliminación
    if (!confirm(`¿Está seguro de que desea eliminar la compañía "${cotizadorData.companias[index].nombre}"?`)) {
        return;
    }
    
    // Eliminar la compañía de los datos
    cotizadorData.companias.splice(index, 1);
    
    // Si no quedan compañías, agregar una nueva
    if (cotizadorData.companias.length === 0) {
        addNewCompany();
    }
    
    // Regenerar la tabla de compañías
    generateCompaniesTable();
}

// Guardar los cambios de las compañías
function saveCompaniesChanges() {
    try {
    // Guardar los cambios de cada compañía
        const rows = document.querySelectorAll('.companies-table tbody tr');
        let currentCompanyIndex = -1;
        let currentCurrency = '';
        let updatedCompanies = [...cotizadorData.companias]; // Crear una copia del array original

        rows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            const currencyCell = row.querySelector('.currency-cell');
            
            if (currencyCell) {
                currentCurrency = currencyCell.textContent;
            }
            
            const companyNameCell = row.querySelector('.company-name-input');
            if (companyNameCell) {
                currentCompanyIndex++;
                if (!updatedCompanies[currentCompanyIndex]) {
                    updatedCompanies[currentCompanyIndex] = {
                        nombre: companyNameCell.value,
                        prima_minima: { ARS: 0, USD: 0, EUR: 0 },
                        derecho_emision: { ARS: 0, USD: 0, EUR: 0 },
                        escribano_solo: { ARS: 0, USD: 0, EUR: 0 },
                        escribano_colegio: { ARS: 0, USD: 0, EUR: 0 },
                        impuesto_pais: 0,
                        recargo_administrativo: 0
                    };
                }
                updatedCompanies[currentCompanyIndex].nombre = companyNameCell.value.trim();
            }

            if (currentCompanyIndex >= 0 && currentCurrency) {
                inputs.forEach(input => {
                    const fieldName = input.getAttribute('data-field');
                    const value = parseFloat(input.value) || 0;

                    if (fieldName === 'impuesto_pais' || fieldName === 'recargo_administrativo') {
                        updatedCompanies[currentCompanyIndex][fieldName] = value;
                    } else if (fieldName) {
                        updatedCompanies[currentCompanyIndex][fieldName][currentCurrency] = value;
                    }
                });
            }
        });

        // Actualizar los datos
        cotizadorData.companias = updatedCompanies;
        
        // Guardar en localStorage
    localStorage.setItem('cotizadorData', JSON.stringify(cotizadorData));
    
    // Actualizar el selector de compañías
    loadCompaniesIntoSelector();
    
    // Cerrar el modal
    closeCompaniesModal();
    
    // Mostrar mensaje de éxito
    alert('Los cambios se han guardado correctamente');
        
        // Limpiar el indicador de cambios pendientes
        clearChangesPending();
    } catch (error) {
        console.error('Error al guardar los cambios:', error);
        alert('Hubo un error al guardar los cambios. Por favor, intente nuevamente.');
    }
}

// Cargar datos desde localStorage al iniciar
function loadDataFromLocalStorage() {
    const savedData = localStorage.getItem('cotizadorData');
    if (savedData) {
        try {
            const parsedData = JSON.parse(savedData);
            if (parsedData && parsedData.companias && parsedData.impuestos && parsedData.periodicidad) {
                // Asegurarse de que los sellados se mantengan si no existen en los datos guardados
                if (!parsedData.sellados) {
                    parsedData.sellados = alicuotas_impuesto_sellos;
                }
                
                // Verificar y asegurar que cada compañía tenga la estructura correcta
                parsedData.companias = parsedData.companias.map(company => {
                    return {
                        nombre: company.nombre || '',
                        prima_minima: {
                            ARS: parseFloat(company.prima_minima?.ARS) || 0,
                            USD: parseFloat(company.prima_minima?.USD) || 0,
                            EUR: parseFloat(company.prima_minima?.EUR) || 0
                        },
                        derecho_emision: {
                            ARS: parseFloat(company.derecho_emision?.ARS) || 0,
                            USD: parseFloat(company.derecho_emision?.USD) || 0,
                            EUR: parseFloat(company.derecho_emision?.EUR) || 0
                        },
                        escribano_solo: {
                            ARS: parseFloat(company.escribano_solo?.ARS) || 0,
                            USD: parseFloat(company.escribano_solo?.USD) || 0,
                            EUR: parseFloat(company.escribano_solo?.EUR) || 0
                        },
                        escribano_colegio: {
                            ARS: parseFloat(company.escribano_colegio?.ARS) || 0,
                            USD: parseFloat(company.escribano_colegio?.USD) || 0,
                            EUR: parseFloat(company.escribano_colegio?.EUR) || 0
                        },
                        impuesto_pais: parseFloat(company.impuesto_pais) || 0,
                        recargo_administrativo: parseFloat(company.recargo_administrativo) || 0
                    };
                });
                
                cotizadorData = parsedData;
                console.log('Datos cargados desde localStorage');
            }
        } catch (error) {
            console.warn('Error al cargar datos desde localStorage:', error);
        }
    }
}

// Intentar cargar datos desde localStorage al iniciar
loadDataFromLocalStorage();

// Funciones para el editor de impuestos
function updateTaxData(field, value) {
    cotizadorData.impuestos[field] = parseFloat(value) || 0;
    markChangesPending();
    const saveButton = document.getElementById('save-taxes-btn');
    if (saveButton) {
        saveButton.classList.add('has-changes');
    }
}

// Inicializar eventos para el editor de impuestos
function initializeTaxEditor() {
    // Agregar eventos para los campos de impuestos
    document.getElementById('tax-intereses-internos').addEventListener('change', function() {
        updateTaxData('intereses_internos', this.value);
    });
    document.getElementById('tax-tasa-ssn').addEventListener('change', function() {
        updateTaxData('tasa_ssn', this.value);
    });
    document.getElementById('tax-osseg').addEventListener('change', function() {
        updateTaxData('osseg', this.value);
    });
    document.getElementById('tax-iva').addEventListener('change', function() {
        updateTaxData('iva', this.value);
    });

    // Evento para el botón de guardar cambios
    document.getElementById('save-taxes-btn').addEventListener('click', saveTaxChanges);

    // Cargar los datos de impuestos en el formulario
    document.getElementById('tax-intereses-internos').value = cotizadorData.impuestos.intereses_internos;
    document.getElementById('tax-tasa-ssn').value = cotizadorData.impuestos.tasa_ssn;
    document.getElementById('tax-osseg').value = cotizadorData.impuestos.osseg;
    document.getElementById('tax-iva').value = cotizadorData.impuestos.iva;

    // Generar la tabla de sellados
    generateStampsTable();
}

// Guardar los cambios de impuestos
function saveTaxChanges() {
    // Guardar los valores actuales de impuestos generales
    cotizadorData.impuestos.intereses_internos = parseFloat(document.getElementById('tax-intereses-internos').value) || 0;
    cotizadorData.impuestos.tasa_ssn = parseFloat(document.getElementById('tax-tasa-ssn').value) || 0;
    cotizadorData.impuestos.osseg = parseFloat(document.getElementById('tax-osseg').value) || 0;
    cotizadorData.impuestos.iva = parseFloat(document.getElementById('tax-iva').value) || 0;

    // Guardar en localStorage
    localStorage.setItem('cotizadorData', JSON.stringify(cotizadorData));

    // Limpiar indicador de cambios
    const saveButton = document.getElementById('save-taxes-btn');
    if (saveButton) {
        saveButton.classList.remove('has-changes');
    }

    // Cerrar el modal
    closeTaxesModal();

    // Mostrar mensaje de éxito
    alert('Los cambios en los impuestos se han guardado correctamente');
}

// Abrir el modal de impuestos
function openTaxesModal() {
    // Cargar los valores actuales
    document.getElementById('tax-intereses-internos').value = cotizadorData.impuestos.intereses_internos;
    document.getElementById('tax-tasa-ssn').value = cotizadorData.impuestos.tasa_ssn;
    document.getElementById('tax-osseg').value = cotizadorData.impuestos.osseg;
    document.getElementById('tax-iva').value = cotizadorData.impuestos.iva;

    // Mostrar el modal
    document.getElementById('taxes-modal').style.display = 'block';
}

// Cerrar el modal de impuestos
function closeTaxesModal() {
    document.getElementById('taxes-modal').style.display = 'none';
}

// Evento para cerrar el modal cuando se hace clic fuera de él
window.addEventListener('click', function(event) {
    const modal = document.getElementById('taxes-modal');
    if (event.target === modal) {
        closeTaxesModal();
    }
});

// Evento para el botón de cerrar del modal de impuestos
document.addEventListener('DOMContentLoaded', function() {
    const closeButton = document.getElementById('close-taxes-modal');
    if (closeButton) {
        closeButton.addEventListener('click', function() {
            closeTaxesModal();
        });
    }
});

// Función para cargar jurisdicciones en el selector
function loadJurisdictionsIntoSelector() {
    const jurisdictionSelect = document.getElementById('jurisdiction');
    jurisdictionSelect.innerHTML = '<option value="" disabled selected hidden>Seleccione una jurisdicción</option>';
    
    Object.keys(cotizadorData.sellados).sort().forEach(jurisdiccion => {
        const option = document.createElement('option');
        option.value = jurisdiccion;
        option.textContent = jurisdiccion;
        jurisdictionSelect.appendChild(option);
    });
}

// Función para generar la tabla de sellados
function generateStampsTable() {
    const tableBody = document.getElementById('stamps-table-body');
    tableBody.innerHTML = '';
    
    Object.entries(cotizadorData.sellados).sort().forEach(([jurisdiccion, alicuota]) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${jurisdiccion}</td>
            <td>
                <input type="number" step="0.01" min="0" value="${alicuota}" 
                 onchange="updateStampRate('${jurisdiccion}', this.value)">
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Función para actualizar una alícuota
function updateStampRate(jurisdiccion, valor) {
    cotizadorData.sellados[jurisdiccion] = parseFloat(valor) || 0;
    markChangesPending();
}

// Función para inicializar el porcentaje de sellado según la jurisdicción
function initializeStampPercentage() {
    const jurisdiccion = document.getElementById('jurisdiction').value;
    if (jurisdiccion) {
        const alicuota = cotizadorData.sellados[jurisdiccion];
        document.getElementById('stamp-percentage').value = alicuota;
        document.getElementById('stamps-percentage').value = alicuota;
        markChangesPending();
    }
}

// Función para actualizar el nombre de una compañía
function updateCompanyName(companyIndex, newName) {
    try {
        // Validar que el índice de la compañía sea válido
        if (companyIndex < 0 || companyIndex >= cotizadorData.companias.length) {
            throw new Error('Índice de compañía inválido');
        }

        // Validar que el nombre no esté vacío
        if (!newName || newName.trim() === '') {
            throw new Error('El nombre de la compañía no puede estar vacío');
        }

        // Actualizar el nombre
        cotizadorData.companias[companyIndex].nombre = newName.trim();

        // Marcar que hay cambios pendientes
        markChangesPending();

        // Actualizar la interfaz
        const saveButton = document.getElementById('save-companies-btn');
        if (saveButton) {
            saveButton.classList.add('has-changes');
        }
    } catch (error) {
        console.error('Error al actualizar el nombre de la compañía:', error);
        alert('Error al actualizar el nombre. Por favor, verifique que sea válido.');
    }
}

function initializeFields() {
    const company = document.getElementById('company').value;
    const selectedCompany = cotizadorData.companias.find(c => c.nombre === company);
    
    if (selectedCompany) {
        console.log('Compañía seleccionada:', selectedCompany);
        
        // Inicializar campos de porcentajes
        document.getElementById('country-tax-percentage').value = selectedCompany.impuesto_pais;
        document.getElementById('administrative-surcharge-percentage').value = selectedCompany.recargo_administrativo;
        document.getElementById('internal-interest-percentage').value = cotizadorData.impuestos.intereses_internos;
        document.getElementById('ssn-rate-percentage').value = cotizadorData.impuestos.tasa_ssn;
        document.getElementById('osseg-percentage').value = cotizadorData.impuestos.osseg;
        document.getElementById('vat-percentage').value = cotizadorData.impuestos.iva;
        
        // Inicializar el porcentaje de sellado según la jurisdicción seleccionada
        const jurisdiccion = document.getElementById('jurisdiction').value;
        if (jurisdiccion && cotizadorData.sellados[jurisdiccion]) {
            document.getElementById('stamps-percentage').value = cotizadorData.sellados[jurisdiccion];
        }
        
        // Inicializar campos de valores monetarios
        const currency = document.getElementById('currency').value;
        console.log('Moneda seleccionada:', currency);
        
        if (currency) {
            console.log('Derecho de emisión para la moneda:', selectedCompany.derecho_emision[currency]);
            
            // Inicializar derecho de emisión
            const emissionRightValue = selectedCompany.derecho_emision[currency];
            document.getElementById('emission-right-value').value = emissionRightValue;
            
            // Inicializar el valor de escribanía según el tipo seleccionado
            const notaryType = document.getElementById('notary-type').value;
            if (notaryType === 'Escribano Solo') {
                document.getElementById('notary-value').value = selectedCompany.escribano_solo[currency];
            } else if (notaryType === 'Escribano+Colegio') {
                document.getElementById('notary-value').value = selectedCompany.escribano_colegio[currency];
            } else {
                document.getElementById('notary-value').value = '0';
            }
        }
    }
    
    // Marcar cambios como pendientes después de la inicialización
    markChangesPending();
}
