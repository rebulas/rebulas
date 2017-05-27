clients = load('Clients.txt');
name = load('Name.txt');
releases = load('Releases.txt');
people = load('People.txt');

data = {clients , name , releases, people };
colors = {'black', 'green', 'red', 'blue'};

hold on;
for i = 1:4
  subplot(1, 4, i);
  hist(data{i}, 'facecolor', colors{i});
  printf('Mean: %f\n', mean(data{i}))
  printf('Std: %f\n', std(data{i}))
endfor
hold off;