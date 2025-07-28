class ConstructionAnalytics {
    constructor() {
        this.formsData = [];
        this.tasksData = [];
        this.processedData = [];
        this.mlModel = null;

        this.initializeEventListeners();
        this.initializeCharts();
    }

    initializeEventListeners() {
        document.getElementById('formsFile').addEventListener('change', (e) => this.handleFileUpload(e, 'forms'));
        document.getElementById('tasksFile').addEventListener('change', (e) => this.handleFileUpload(e, 'tasks'));
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeData());
        // Filter listeners
        document.getElementById('projectFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('typeFilter').addEventListener('change', () => this.applyFilters());

        // Single task prediction listener
        document.getElementById('predictSingleTask').addEventListener('click', () => this.predictSingleTask());
    }

    initializeCharts() {
        // Initialize Chart.js charts
        this.statusChart = new Chart(document.getElementById('statusChart'), {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: ['#e53e3e', '#38a169', '#dd6b20', '#3182ce', '#805ad5']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        this.timelineChart = new Chart(document.getElementById('timelineChart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Total Created',
                        data: [],
                        borderColor: '#4299e1',
                        backgroundColor: 'rgba(66, 153, 225, 0.1)',
                        tension: 0.4,
                        fill: false
                    },
                    {
                        label: 'Delayed Items',
                        data: [],
                        borderColor: '#e53e3e',
                        backgroundColor: 'rgba(229, 62, 62, 0.1)',
                        tension: 0.4,
                        fill: false
                    },
                    {
                        label: 'On-Time Items',
                        data: [],
                        borderColor: '#38a169',
                        backgroundColor: 'rgba(56, 161, 105, 0.1)',
                        tension: 0.4,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });

        this.riskChart = new Chart(document.getElementById('riskChart'), {
            type: 'pie',
            data: {
                labels: ['Low Risk', 'Medium Risk', 'High Risk'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#38a169', '#dd6b20', '#e53e3e']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        this.tasksPerYearChart = new Chart(document.getElementById('tasksPerYearChart'), {
            type: 'pie',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: ['#4299e1', '#38a169', '#dd6b20', '#e53e3e', '#805ad5', '#f6ad55', '#68d391']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    async handleFileUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        const text = await file.text();
        const parseResult = this.parseCSV(text);

        if (type === 'forms') {
            const cleanResult = this.cleanFormsData(parseResult.data);
            this.formsData = cleanResult.validData;
            const totalRows = parseResult.data.length;
            const validRows = cleanResult.validData.length;
            const errorRows = totalRows - validRows + parseResult.errorCount;

            document.getElementById('formsInfo').innerHTML = `
                <div style="color: #2b6cb0; font-weight: bold;">${validRows} forms loaded</div>
                <div style="color: #666; font-size: 0.9em;">Total rows: ${totalRows + parseResult.errorCount}</div>
                ${errorRows > 0 ? `<div style="color: #e53e3e; font-size: 0.9em;">${errorRows} rows with errors</div>` : ''}
            `;
        } else {
            const cleanResult = this.cleanTasksData(parseResult.data);
            this.tasksData = cleanResult.validData;
            const totalRows = parseResult.data.length;
            const validRows = cleanResult.validData.length;
            const errorRows = totalRows - validRows + parseResult.errorCount;

            document.getElementById('tasksInfo').innerHTML = `
                <div style="color: #2b6cb0; font-weight: bold;">${validRows} tasks loaded</div>
                <div style="color: #666; font-size: 0.9em;">Total rows: ${totalRows + parseResult.errorCount}</div>
                ${errorRows > 0 ? `<div style="color: #e53e3e; font-size: 0.9em;">${errorRows} rows with errors</div>` : ''}
            `;
        }

        // Enable analyze button if both files are loaded
        if (this.formsData.length > 0 && this.tasksData.length > 0) {
            document.getElementById('analyzeBtn').disabled = false;
        }
    }

    parseCSV(text) {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) return { data: [], errorCount: 0 };

        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const data = [];
        let errorCount = 0;

        for (let i = 1; i < lines.length; i++) {
            try {
                const values = this.parseCSVLine(lines[i]);
                if (values.length === headers.length) {
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index];
                    });
                    data.push(row);
                } else {
                    errorCount++;
                    console.warn(`Row ${i + 1}: Expected ${headers.length} columns, got ${values.length}`);
                }
            } catch (error) {
                errorCount++;
                console.warn(`Row ${i + 1}: Parse error -`, error.message);
            }
        }

        return { data, errorCount };
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    cleanFormsData(data) {
        const validData = [];
        let invalidCount = 0;

        data.forEach(row => {
            if (row.Ref && 
                row.Ref.startsWith('F') && 
                row.Status && 
                row.Project) {
                validData.push({
                    ...row,
                    Created: this.parseDate(row.Created),
                    'Status Changed': this.parseDate(row['Status Changed']),
                    OverDue: row.OverDue === 'TRUE'
                });
            } else {
                invalidCount++;
                console.warn('Invalid form row:', row);
            }
        });

        return { validData, invalidCount };
    }

    cleanTasksData(data) {
        const validData = [];
        let invalidCount = 0;

        data.forEach(row => {
            if (row.Ref && 
                row.Ref.startsWith('T') && 
                row.Status && 
                row.project) {
                validData.push({
                    ...row,
                    Created: this.parseDate(row.Created),
                    Target: this.parseDate(row.Target),
                    'Status Changed': this.parseDate(row['Status Changed']),
                    OverDue: row.OverDue === 'TRUE'
                });
            } else {
                invalidCount++;
                console.warn('Invalid task row:', row);
            }
        });

        return { validData, invalidCount };
    }

    parseDate(dateString) {
        if (!dateString || dateString.trim() === '') return null;

        // Handle DD/MM/YYYY format
        const parts = dateString.split('/');
        if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }

        return new Date(dateString);
    }

    analyzeData() {
        this.processedData = [...this.formsData, ...this.tasksData];

        this.updateSummaryStats();
        this.updateFilters();
        this.updateCharts();
        this.updateTasksPerYearChart();
        this.updateTopOpenStatus();
        this.updateDataTable();
    }

    updatePerformanceMetrics(data = this.processedData) {
        const completedItems = data.filter(item => 
            item.Status && (item.Status.toLowerCase().includes('complete') || 
                          item.Status.toLowerCase().includes('closed') ||
                          item.Status.toLowerCase().includes('done'))
        );

        const totalItems = data.length;
        const completionRate = totalItems > 0 ? (completedItems.length / totalItems * 100).toFixed(1) : 0;

        const overdueItems = data.filter(item => item.OverDue);
        const overdueRate = totalItems > 0 ? (overdueItems.length / totalItems * 100).toFixed(1) : 0;

        const onTimeItems = completedItems.filter(item => !item.OverDue);
        const onTimeRate = completedItems.length > 0 ? (onTimeItems.length / completedItems.length * 100).toFixed(1) : 0;

        // Calculate average duration for completed tasks
        const tasksWithDuration = completedItems.filter(item => item.Created && item['Status Changed']);
        let avgDuration = 0;
        if (tasksWithDuration.length > 0) {
            const totalDuration = tasksWithDuration.reduce((acc, item) => {
                const duration = (item['Status Changed'] - item.Created) / (1000 * 60 * 60 * 24);
                return acc + Math.max(0, duration);
            }, 0);
            avgDuration = Math.round(totalDuration / tasksWithDuration.length);
        }

        document.getElementById('completionRate').textContent = `${completionRate}%`;
        document.getElementById('avgDuration').textContent = `${avgDuration} days`;
        document.getElementById('overdueRate').textContent = `${overdueRate}%`;
        document.getElementById('onTimeRate').textContent = `${onTimeRate}%`;
    }

    updateSummaryStats(data = this.processedData) {
        const totalForms = data.filter(item => item.Ref && item.Ref.startsWith('F')).length;
        const totalTasks = data.filter(item => item.Ref && item.Ref.startsWith('T')).length;
        const openItems = data.filter(item => 
            item.Status && (item.Status.toLowerCase().includes('open') || 
                          item.Status.toLowerCase().includes('ongoing'))
        ).length;
        const overdueItems = data.filter(item => item.OverDue).length;

        document.getElementById('totalForms').textContent = totalForms;
        document.getElementById('totalTasks').textContent = totalTasks;
        document.getElementById('openItems').textContent = openItems;
        document.getElementById('overdueItems').textContent = overdueItems;
    }

    updateFilters() {
        // Update project filter
        const projects = [...new Set(this.processedData.map(item => item.Project || item.project).filter(Boolean))];
        const projectFilter = document.getElementById('projectFilter');
        projectFilter.innerHTML = '<option value="">All Projects</option>';
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project;
            option.textContent = project;
            projectFilter.appendChild(option);
        });

        // Update task project dropdown
        const taskProjectFilter = document.getElementById('taskProject');
        taskProjectFilter.innerHTML = '<option value="">Select Project</option>';
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project;
            option.textContent = project;
            taskProjectFilter.appendChild(option);
        });

        // Update status filter
        const statuses = [...new Set(this.processedData.map(item => item.Status).filter(Boolean))];
        const statusFilter = document.getElementById('statusFilter');
        statusFilter.innerHTML = '<option value="">All Status</option>';
        statuses.forEach(status => {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            statusFilter.appendChild(option);
        });

        // Update type filter
        const types = [...new Set(this.processedData.map(item => item.Type).filter(Boolean))];
        const typeFilter = document.getElementById('typeFilter');
        typeFilter.innerHTML = '<option value="">All Types</option>';
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeFilter.appendChild(option);
        });

        // Update task type dropdown for prediction form
        const taskTypeFilter = document.getElementById('taskType');
        taskTypeFilter.innerHTML = '<option value="">Select Task Type</option>';
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            taskTypeFilter.appendChild(option);
        });

        // Generate and display new task reference
        this.generateTaskReference();
    }

    generateTaskReference() {
        // Generate a new task reference based on existing pattern
        const existingTaskRefs = this.tasksData
            .map(item => item.Ref)
            .filter(ref => ref && ref.startsWith('T'))
            .map(ref => {
                const match = ref.match(/T(\d+)/);
                return match ? parseInt(match[1]) : 0;
            })
            .filter(num => num > 0);

        const maxTaskNum = existingTaskRefs.length > 0 ? Math.max(...existingTaskRefs) : 1000000;
        const newTaskRef = `T${maxTaskNum + 1}`;

        document.getElementById('taskRefDisplay').textContent = newTaskRef;
        return newTaskRef;
    }

    updateCharts() {
        // Status distribution
        const statusCounts = {};
        this.processedData.forEach(item => {
            const status = item.Status || 'Unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        this.statusChart.data.labels = Object.keys(statusCounts);
        this.statusChart.data.datasets[0].data = Object.values(statusCounts);
        this.statusChart.update();

        // Timeline chart with multiple curves
        const timelineCounts = {};
        const delayedCounts = {};
        const onTimeCounts = {};

        this.processedData.forEach(item => {
            if (item.Created) {
                const monthYear = `${item.Created.getMonth() + 1}/${item.Created.getFullYear()}`;
                timelineCounts[monthYear] = (timelineCounts[monthYear] || 0) + 1;
                
                if (item.OverDue) {
                    delayedCounts[monthYear] = (delayedCounts[monthYear] || 0) + 1;
                } else {
                    onTimeCounts[monthYear] = (onTimeCounts[monthYear] || 0) + 1;
                }
            }
        });

        const sortedTimeline = Object.entries(timelineCounts).sort((a, b) => {
            const [monthA, yearA] = a[0].split('/').map(Number);
            const [monthB, yearB] = b[0].split('/').map(Number);
            return yearA - yearB || monthA - monthB;
        });

        const labels = sortedTimeline.map(([date]) => date);
        
        this.timelineChart.data.labels = labels;
        this.timelineChart.data.datasets[0].data = labels.map(label => timelineCounts[label] || 0);
        this.timelineChart.data.datasets[1].data = labels.map(label => delayedCounts[label] || 0);
        this.timelineChart.data.datasets[2].data = labels.map(label => onTimeCounts[label] || 0);
        this.timelineChart.update();
    }

    updateTasksPerYearChart() {
        // Count tasks per year
        const yearCounts = {};
        this.tasksData.forEach(task => {
            if (task.Created) {
                const year = task.Created.getFullYear();
                yearCounts[year] = (yearCounts[year] || 0) + 1;
            }
        });

        // Sort years
        const sortedYears = Object.entries(yearCounts).sort((a, b) => a[0] - b[0]);

        this.tasksPerYearChart.data.labels = sortedYears.map(([year]) => year);
        this.tasksPerYearChart.data.datasets[0].data = sortedYears.map(([, count]) => count);
        this.tasksPerYearChart.update();
    }

    updateTopOpenStatus(data = this.processedData) {
        const openItems = data.filter(item => 
            item.Status && (item.Status.toLowerCase().includes('open') || 
                          item.Status.toLowerCase().includes('ongoing'))
        );

        const typeCounts = {};
        openItems.forEach(item => {
            const type = item.Type || 'Unknown';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });

        const sortedTypes = Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const container = document.getElementById('topOpenStatus');
        container.innerHTML = '';

        if (sortedTypes.length === 0) {
            container.innerHTML = '<p style="color: #666; font-style: italic;">No open items found</p>';
            return;
        }

        sortedTypes.forEach(([type, count]) => {
            const item = document.createElement('div');
            item.className = 'top-status-item';
            item.innerHTML = `
                <span>${type}</span>
                <span class="stat-value">${count}</span>
            `;
            container.appendChild(item);
        });
    }

    applyFilters() {
        const projectFilter = document.getElementById('projectFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const typeFilter = document.getElementById('typeFilter').value;

        let filteredData = this.processedData;

        if (projectFilter) {
            filteredData = filteredData.filter(item => 
                (item.Project || item.project) === projectFilter
            );
        }

        if (statusFilter) {
            filteredData = filteredData.filter(item => item.Status === statusFilter);
        }

        if (typeFilter) {
            filteredData = filteredData.filter(item => item.Type === typeFilter);
        }

        // Update summary stats with filtered data
        this.updateSummaryStats(filteredData);

        // Update top open status with filtered data
        this.updateTopOpenStatus(filteredData);

        this.updateDataTable(filteredData);
    }

    updateDataTable(data = this.processedData) {
        const tbody = document.querySelector('#dataTable tbody');
        tbody.innerHTML = '';

        data.slice(0, 100).forEach(item => { // Limit to 100 rows for performance
            const row = document.createElement('tr');
            if (item.OverDue) {
                row.classList.add('overdue');
            }

            const statusClass = item.Status && item.Status.toLowerCase().includes('open') ? 'status-open' : 'status-closed';

            row.innerHTML = `
                <td>${item.Ref || ''}</td>
                <td class="${statusClass}">${item.Status || ''}</td>
                <td>${item.Type || ''}</td>
                <td>${item.Project || item.project || ''}</td>
                <td>${item.Created ? item.Created.toLocaleDateString() : ''}</td>
                <td>${item.Target ? item.Target.toLocaleDateString() : ''}</td>
                <td>${item.OverDue ? 'Yes' : 'No'}</td>
            `;
            tbody.appendChild(row);
        });
    }



    prepareMLFeatures() {
        const openItems = this.processedData.filter(item => 
            item.Status && (item.Status.toLowerCase().includes('open') || 
                          item.Status.toLowerCase().includes('ongoing'))
        );

        return openItems.map(item => {
            const daysSinceCreated = item.Created ? 
                (new Date() - item.Created) / (1000 * 60 * 60 * 24) : 0;

            const hasTarget = item.Target ? 1 : 0;
            const daysUntilTarget = item.Target ? 
                (item.Target - new Date()) / (1000 * 60 * 60 * 24) : 30;

            const isOverdue = item.OverDue ? 1 : 0;
            const hasImages = item.Images === 'TRUE' ? 1 : 0;
            const hasComments = item.Comments === 'TRUE' ? 1 : 0;

            // Simple risk scoring based on various factors
            let riskScore = 0;
            if (isOverdue) riskScore += 0.4;
            if (daysSinceCreated > 30) riskScore += 0.3;
            if (daysUntilTarget < 0) riskScore += 0.3;
            if (daysUntilTarget < 7 && daysUntilTarget >= 0) riskScore += 0.2;
            if (!hasComments && !hasImages) riskScore += 0.1;

            return {
                item,
                features: [
                    daysSinceCreated / 100, // Normalize
                    hasTarget,
                    Math.max(-30, Math.min(100, daysUntilTarget)) / 100, // Normalize and clamp
                    isOverdue,
                    hasImages,
                    hasComments
                ],
                riskScore: Math.min(1, riskScore)
            };
        });
    }

    async trainDelayPredictionModel(featureData) {
        if (featureData.length === 0) return;

        // Create a simple neural network model
        this.mlModel = tf.sequential({
            layers: [
                tf.layers.dense({
                    units: 16,
                    activation: 'relu',
                    inputShape: [6] // 6 features
                }),
                tf.layers.dense({
                    units: 8,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: 1,
                    activation: 'sigmoid'
                })
            ]
        });

        this.mlModel.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError'
        });

        // Prepare training data
        const xs = tf.tensor2d(featureData.map(d => d.features));
        const ys = tf.tensor2d(featureData.map(d => [d.riskScore]));

        // Train the model
        await this.mlModel.fit(xs, ys, {
            epochs: 50,
            batchSize: 32,
            verbose: 0
        });

        xs.dispose();
        ys.dispose();
    }

    async makePredictions(featureData) {
        if (!this.mlModel || featureData.length === 0) return [];

        const xs = tf.tensor2d(featureData.map(d => d.features));
        const predictions = this.mlModel.predict(xs);
        const predictionArray = await predictions.data();

        xs.dispose();
        predictions.dispose();

        return featureData.map((data, index) => ({
            ...data,
            delayProbability: predictionArray[index],
            riskLevel: this.categorizeRisk(predictionArray[index])
        }));
    }

    categorizeRisk(probability) {
        if (probability > 0.7) return 'high';
        if (probability > 0.4) return 'medium';
        return 'low';
    }

    displayPredictions(predictions) {
        const container = document.getElementById('predictionResults');

        // Sort by delay probability (highest first)
        const sortedPredictions = predictions
            .sort((a, b) => b.delayProbability - a.delayProbability)
            .slice(0, 10); // Show top 10 at-risk items

        let html = '<h4 style="color: #000000; margin-bottom: 15px;">Top 10 Items at Risk of Delay:</h4>';

        sortedPredictions.forEach(pred => {
            const riskClass = `risk-${pred.riskLevel}`;
            const percentage = (pred.delayProbability * 100).toFixed(1);

            html += `
                <div class="prediction-item ${riskClass}" style="color: #000000;">
                    <strong>${pred.item.Ref}</strong> - ${pred.item.Status}
                    <br>
                    <small style="color: #333333;">${pred.item.Type || 'N/A'} | Delay Risk: ${percentage}%</small>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    updateRiskChart(predictions) {
        const riskCounts = { low: 0, medium: 0, high: 0 };

        predictions.forEach(pred => {
            riskCounts[pred.riskLevel]++;
        });

        this.riskChart.data.datasets[0].data = [
            riskCounts.low,
            riskCounts.medium,
            riskCounts.high
        ];
        this.riskChart.update();
    }

    async predictSingleTask() {
        // Get generated task reference
        const taskRef = document.getElementById('taskRefDisplay').textContent;
        const taskProject = document.getElementById('taskProject').value;
        const taskType = document.getElementById('taskType').value;
        const taskTarget = document.getElementById('taskTarget').value;

        if (!taskProject || !taskType) {
            document.getElementById('singleTaskPrediction').innerHTML = 
                '<p style="color: red;">Please select Project and Task Type</p>';
            return;
        }

        // Train model if not already trained
        if (!this.mlModel) {
            try {
                const features = this.prepareMLFeatures();
                if (features.length > 0) {
                    await this.trainDelayPredictionModel(features);

                    // Update prediction results with existing data analysis
                    const predictions = await this.makePredictions(features);
                    this.displayPredictions(predictions);
                    this.updateRiskChart(predictions);
                } else {
                    document.getElementById('singleTaskPrediction').innerHTML = 
                        '<p style="color: orange;">No sufficient data to train the prediction model</p>';
                    return;
                }
            } catch (error) {
                console.error('Model training error:', error);
                document.getElementById('singleTaskPrediction').innerHTML = 
                    '<p style="color: red;">Error training prediction model</p>';
                return;
            }
        }

        try {
            // Prepare features for the new task
            const features = this.prepareSingleTaskFeatures({
                Ref: taskRef,
                Project: taskProject,
                Type: taskType,
                Target: taskTarget ? new Date(taskTarget) : null,
                Created: new Date(), // Current date as creation date
                Images: document.getElementById('taskHasImages').checked ? 'TRUE' : 'FALSE',
                Comments: document.getElementById('taskHasComments').checked ? 'TRUE' : 'FALSE',
                Priority: document.getElementById('taskPriority').value
            });

            // Make prediction
            const prediction = await this.makeSinglePrediction(features);

            // Display result
            this.displaySingleTaskPrediction(prediction, taskRef, taskProject);

        } catch (error) {
            console.error('Single task prediction error:', error);
            document.getElementById('singleTaskPrediction').innerHTML = 
                '<p style="color: red;">Error making prediction. Please try again.</p>';
        }
    }

    prepareSingleTaskFeatures(task) {
        const daysSinceCreated = 0; // New task, so 0 days
        const hasTarget = task.Target ? 1 : 0;
        const daysUntilTarget = task.Target ? 
            (task.Target - new Date()) / (1000 * 60 * 60 * 24) : 30;

        const isOverdue = 0; // New task, so not overdue yet
        const hasImages = task.Images === 'TRUE' ? 1 : 0;
        const hasComments = task.Comments === 'TRUE' ? 1 : 0;

        // Calculate base risk score for new task
        let riskScore = 0;

        // Priority-based risk
        if (task.Priority === 'high') riskScore += 0.3;
        else if (task.Priority === 'medium') riskScore += 0.1;

        // Target date-based risk
        if (daysUntilTarget < 7 && daysUntilTarget >= 0) riskScore += 0.2;
        else if (daysUntilTarget < 0) riskScore += 0.4;
        else if (daysUntilTarget > 30) riskScore += 0.1;

        // Documentation-based risk
        if (!hasComments && !hasImages) riskScore += 0.15;

        // Project-based risk (analyze historical data for this project)
        const projectData = this.processedData.filter(item => 
            (item.Project || item.project) === task.Project
        );

        if (projectData.length > 0) {
            const overdueRate = projectData.filter(item => item.OverDue).length / projectData.length;
            riskScore += overdueRate * 0.25;
        }

        return {
            task,
            features: [
                daysSinceCreated / 100, // Normalize
                hasTarget,
                Math.max(-30, Math.min(100, daysUntilTarget)) / 100, // Normalize and clamp
                isOverdue,
                hasImages,
                hasComments
            ],
            riskScore: Math.min(1, riskScore)
        };
    }

    async makeSinglePrediction(featureData) {
        const xs = tf.tensor2d([featureData.features]);
        const prediction = this.mlModel.predict(xs);
        const predictionValue = await prediction.data();

        xs.dispose();
        prediction.dispose();

        // Combine ML prediction with rule-based risk score
        const finalProbability = (predictionValue[0] + featureData.riskScore) / 2;

        return {
            ...featureData,
            delayProbability: finalProbability,
            riskLevel: this.categorizeRisk(finalProbability)
        };
    }

    displaySingleTaskPrediction(prediction, taskRef, taskProject) {
        const container = document.getElementById('singleTaskPrediction');
        const percentage = (prediction.delayProbability * 100).toFixed(1);
        const taskType = document.getElementById('taskType').value;

        let riskMessage = '';
        let recommendations = '';

        switch (prediction.riskLevel) {
            case 'high':
                riskMessage = `⚠️ HIGH RISK - ${percentage}% kemungkinan delay`;
                recommendations = `
                    <strong>Rekomendasi:</strong>
                    <ul>
                        <li>Prioritaskan task ini segera</li>
                        <li>Assign resource tambahan</li>
                        <li>Monitor progress harian</li>
                        <li>Pertimbangkan untuk memperpendek timeline</li>
                    </ul>
                `;
                break;
            case 'medium':
                riskMessage = `⚡ MEDIUM RISK - ${percentage}% kemungkinan delay`;
                recommendations = `
                    <strong>Rekomendasi:</strong>
                    <ul>
                        <li>Monitor progress mingguan</li>
                        <li>Pastikan resource tersedia</li>
                        <li>Update dokumentasi secara berkala</li>
                    </ul>
                `;
                break;
            case 'low':
                riskMessage = `✅ LOW RISK - ${percentage}% kemungkinan delay`;
                recommendations = `
                    <strong>Status:</strong> Task ini kemungkinan besar akan selesai tepat waktu dengan monitoring rutin.
                `;
                break;
        }

        container.innerHTML = `
            <div class="prediction-result ${prediction.riskLevel}-risk">
                <h4>Potensi Delay: ${taskType}</h4>
                <p><strong>Project:</strong> ${taskProject}</p>
                <p>${riskMessage}</p>
                <div style="text-align: left; margin-top: 10px; font-size: 14px; color: inherit;">
                    ${recommendations}
                </div>
            </div>
        `;

        // Clear form after successful prediction and generate new reference
        this.generateTaskReference();
        document.getElementById('taskProject').value = '';
        document.getElementById('taskType').value = '';
        document.getElementById('taskTarget').value = '';
        document.getElementById('taskPriority').value = 'medium';
        document.getElementById('taskHasImages').checked = false;
        document.getElementById('taskHasComments').checked = false;
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ConstructionAnalytics();
});
