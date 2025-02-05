export function StatisticGroup({ cmpType, group, board }) {

    function getStatisticsStatus(cmp) {
      // Map over the tasks in the group: for each task, find a label
      // whose title matches the task property given by cmp.
      const labels = group.tasks.map(task => {
        // task[cmp] is assumed to be a string that matches a label's title.
        return board.labels.find(label => label.title === task[cmp])
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
          return <GetStatisticsLabel statisticLabels={getStatisticsStatus('status')} />
        case 'priority-picker':
          return <GetStatisticsLabel statisticLabels={getStatisticsStatus('priority')} />
        case 'date-picker':
          return []
        case 'number-picker':
          return <GetStatisticsNumber statisticNumber={getStatisticsNumber()} />
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