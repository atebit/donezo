export function StatisticGroup({ cmpType, group, board }) {

    function getStatisticsStatus(cmp, labelType) {
      // Get the appropriate labels array based on type
      let labelsArray
      if (labelType === 'status') {
        labelsArray = board.statusLabels || board.labels || []
      } else if (labelType === 'priority') {
        labelsArray = board.priorityLabels || board.labels || []
      } else {
        labelsArray = board.labels || []
      }

      // Map over the tasks in the group: for each task, find a label
      // whose title matches the task property given by cmp.
      const labels = group.tasks.map(task => {
        // task[cmp] is assumed to be a string that matches a label's title.
        return labelsArray.find(label => label.title === task[cmp])
      }).filter(label => label) // Remove any undefined values

      // Now reduce this array into an object counting labels by color.
      const mapLabel = labels.reduce((acc, label) => {
        // Use label.color as the key.
        if (acc[label.color]) acc[label.color]++
        else acc[label.color] = 1
        return acc
      }, {})

      // Convert the map into an array of statistic objects.
      const result = []
      for (let color in mapLabel) {
        result.push({
          background: color,
          width: `${(mapLabel[color] / labels.length) * 100}%`
        })
      }
      return result
    }


    function getStatisticsNumber() {
        const sumOfNumbers = group.tasks.reduce((acc, task) => {
            if (task.number) return acc + task.number
            return acc
        }, 0)
        return sumOfNumbers
    }

    function getStatisticsResult() {
      switch (cmpType) {
        case 'member-picker':
          return null
        case 'status-picker':
          return <GetStatisticsLabel statisticLabels={getStatisticsStatus('status', 'status')} />
        case 'priority-picker':
          return <GetStatisticsLabel statisticLabels={getStatisticsStatus('priority', 'priority')} />
        case 'date-picker':
          return []
        case 'number-picker':
          return <GetStatisticsNumber statisticNumber={getStatisticsNumber()} />
        case 'checkbox-picker':
          return <GetStatisticsCheckbox tasks={group.tasks} />
        default: 
          return []
      }
    }



    return (
        <>
            {getStatisticsResult()}
        </>
    )
}

function GetStatisticsLabel({ statisticLabels }) {
    return (
        statisticLabels.map((label, idx) => {
            return <span data-testid={`label-${idx}`} key={idx} style={label} ></span>
        })
    )
}

function GetStatisticsNumber({ statisticNumber }) {
    return (
        <div role="contentinfo" className="statistic-number flex column align-center">
            <span className="number">{statisticNumber}</span>
            <span className="sum">sum</span>
        </div>
    )
}

function GetStatisticsCheckbox({ tasks }) {
    const checkedCount = tasks.filter(task => task.checkbox).length
    const totalCount = tasks.length
    const percentage = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0
    
    return (
        <div role="contentinfo" className="statistic-checkbox flex column align-center">
            <span className="number">{checkedCount}/{totalCount}</span>
            <span className="sum">{percentage}%</span>
        </div>
    )
}