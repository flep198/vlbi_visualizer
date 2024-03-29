//initialize map
var map = L.map('map').setView([50.35805, 10.0636], 3);
L.tileLayer('atlas/{z}/{x}/{y}.jpg', {
    maxZoom: 6,
    minZoom: 1
}).addTo(map);

//initial setup
var wavelength=0.1; //Observing Wavelength in cm
let r_e=6731; //Earth Radius in Kilometers
let imgSize=256; //pixelsize of image
var imgSizeAstro=0.2; //image size in mas
let plotLim=15000; //max plot length of baselines in km
let n_iter=48; //number of iterations for fourier transform
let cc = 9e-6; //contrast constant
let n_iter_times=15; //n_iter*n_iter_times samples of the uv coverage will be calculated, has to be smaller than n_iter
const full_spin_time=40000; //time in milli-seconds for one full spin in play mode

//max baseline length used for uv_grid calculation
let plotLim_calc=imgSize*wavelength/(imgSizeAstro/1000/60/60/180*Math.PI)/100000/2;


//function to transform polar coordinates to cartesian coordinates
function Pol2Cart(r,phi,delta){
let x = r*Math.cos(delta/180*Math.PI)*Math.cos(phi/180*Math.PI);
let y = -r*Math.cos(delta/180*Math.PI)*Math.sin(phi/180*Math.PI);
let z = r*Math.sin(delta/180*Math.PI);

return [x,y,z];
}

//used to save grey scale values of true image fourier transform
var h_ft_image=[];

//Globe Telescope Locations
let locations = [];

//Declination of Source
var declination = 0;

//Source position
let source = [0,declination];

//variable to save the iteration index where to start animation
let first_i=0;

//variable to save the iteration index where to end the observation 
let last_i=0;  

//array to save multiple 2d arrays with the "virtual telescope" as it gradually builds up (display version)
let u_v_grids=[];

//same thing, but with different resolution, used for calculation of the final image
let u_v_grids_calc=[];


//array to save images corresponding to every virtual telescope step
let images=[];

//elevation limit of the telescopes
var elev_lim=0;

//arrray to store boolean whether telescopes can see the source during a certain time step
let tel_visibles=[];

//progress bar
var progress_bar = document.getElementById("myBar");

//update plots according to telescopes and selected time
function updateUVtracks(){


  images=[];

  //update source declination
  source = [200, declination];
  elev_lim=parseInt(elev_lim_control.value); //elevation limit for telescopes in degree

  //calculate u-v transformation matrix from source coordinates (this is important to calculate virtual telescope)
  let H_var=source[0]/180*Math.PI;
  let delta=source[1]/180*Math.PI;

  let matrix=[[Math.sin(H_var),Math.cos(H_var),0],
        [-Math.sin(delta)*Math.cos(H_var),Math.sin(delta)*Math.sin(H_var),Math.cos(delta)],
        [Math.cos(delta)*Math.cos(H_var),-Math.cos(delta)*Math.sin(H_var),Math.sin(delta)]];

  let source_vector=Pol2Cart(r_e,source[0],source[1]);

  //this function calculates one uv-position/baseline, given two telescope coordinates and the source matrix
  function getUV(Tel1,Tel2,matrix){
    let baseline=[Tel2[0]-Tel1[0],Tel2[1]-Tel1[1],Tel2[2]-Tel1[2]];
    return [matrix[0][0]*baseline[0]+matrix[0][1]*baseline[1]+matrix[0][2]*baseline[2],
            matrix[1][0]*baseline[0]+matrix[1][1]*baseline[1]+matrix[1][2]*baseline[2],
            matrix[2][0]*baseline[0]+matrix[2][1]*baseline[2]+matrix[2][2]*baseline[2]];
  }

	//calculate number of baselines
	let n_baselines=Math.round(count_telescopes*(count_telescopes-1)/2);

  //pixel size for images to display
	let pixelSize=plotLim*2/imgSize;
  
  //pixel size for uv_coverage used for calculation
  var pixelSize_calc=plotLim_calc*2/imgSize


  let u_v_grid=Array(imgSize).fill().map(() => Array(imgSize).fill(0)); //create uv_coverage image
  let u_v_grid_calc=Array(imgSize).fill().map(() => Array(imgSize).fill(0)); //create uv_coverage used for calculation
  
  let image=[]; //create image

  let first=true;

  first_i=0;
  last_i=0;

  //array to store whether telescopes can see the source at given time
  tel_visibles=[];

  //start with empty image first
  u_v_grids.push(JSON.parse(JSON.stringify(u_v_grid)));
  u_v_grids_calc.push(JSON.parse(JSON.stringify(u_v_grid_calc)))
  
  //loop to calculate virtual telescope/uv-coverage and image for every time step
  for (let i = 0; i < n_iter*n_iter_times; i++) {

    let t=360/n_iter/n_iter_times*i; //earth rotation angle at this specific time step (full rotation is 360 deg after 24 h)

    
    //convert all telescope positions to cartesian coordinates
    let tels=[];
    let tel_visible=[]; //array to store boolean information whether telescope can see the source or not
    //for loop to set tels and tel_visible values
    for (let j=0; j<telescopes.length;j++){
       	let new_lng=telescopes[j].getLatLng().lng+t;
        if(new_lng>180){
            new_lng=new_lng-360;
        }
        let tel=Pol2Cart(r_e,new_lng,telescopes[j].getLatLng().lat);
        tels[j]=tel;

          //determine whether source is visible to telescope
          let dot_prod=tel[0]*source_vector[0]+tel[1]*source_vector[1]+tel[2]*source_vector[2];
          if (dot_prod/Math.pow(r_e,2)<Math.cos((90-elev_lim)/180*Math.PI)){
              tel_visible[j]=false;
          }else{
              tel_visible[j]=true;
          }       
     }

     tel_visibles.push(tel_visible);
    
     
      let baseline_count=0
      for (let m=0; m<tels.length;m++){
          if (m<(tels.length-1)){
              for (let l=m+1;l<tels.length;l++){
                  if(tel_visible[m] && tel_visible[l]){				

                      if (first){
                        first=false;
                        first_i=i.toString();
                      };

                      //get new u_v data point
                      var baseline_uv=getUV(tels[m],tels[l],matrix);
                      var u=baseline_uv[0];
                      var v=baseline_uv[1];

                      //change to u_v_sampling grid (image)
                      var x_ind=Math.floor((u+plotLim)/pixelSize);
                      var y_ind=Math.floor((v+plotLim)/pixelSize);

                      //change to u_v_sampling grid (calculation)
                      var x_ind_calc=Math.floor((u+plotLim_calc)/pixelSize_calc);
                      var y_ind_calc=Math.floor((v+plotLim_calc)/pixelSize_calc);

                      if (y_ind<imgSize && y_ind>=0 && x_ind<imgSize && x_ind>=0){
                      u_v_grid[y_ind][x_ind]=1;
                      }
                      if (y_ind_calc<imgSize && y_ind_calc>=0 && x_ind_calc<imgSize && x_ind_calc>=0){
                      u_v_grid_calc[y_ind_calc][x_ind_calc]=1;                
                      }    

                      //do the same thing for symmetric baseline

                      var x_ind=Math.floor((-u+plotLim)/pixelSize);
                      var y_ind=Math.floor((-v+plotLim)/pixelSize);

                      //change to u_v_sampling grid (calculation)
                      var x_ind_calc=Math.floor((-u+plotLim_calc)/pixelSize_calc);
                      var y_ind_calc=Math.floor((-v+plotLim_calc)/pixelSize_calc);

                      if (y_ind<imgSize && y_ind>=0 && x_ind<imgSize && x_ind>=0){
                      u_v_grid[y_ind][x_ind]=1;
                      }
                      if (y_ind_calc<imgSize && y_ind_calc>=0 && x_ind_calc<imgSize && x_ind_calc>=0){
                      u_v_grid_calc[y_ind_calc][x_ind_calc]=1;
                      }

                      last_i=i;
									}
                  baseline_count+=1;
               }
            }
      }
      u_v_grids[i]=JSON.parse(JSON.stringify(u_v_grid)); //JSON parse part save array in current status so it doesnt get overwritten
      u_v_grids_calc[i]=JSON.parse(JSON.stringify(u_v_grid_calc));
      }

  //Create Plot of uv-coverage/virtual telescope
  DrawUVCanvas(u_v_grid,ctx_uv,canvas_uv);
  DrawUVCanvas(u_v_grid,ctx_uv_map,canvas_uv_map)

  //compute FT transforms (images)
  for (let aidx=parseInt(first_i);aidx<=last_i; aidx=aidx+n_iter_times){
      setTimeout(function(){
        progress_bar.style.width=Math.round((aidx-first_i)/(last_i-first_i)*100) + "%";
        DrawFourierCanvas(u_v_grids_calc[aidx]);
        if (aidx>=last_i-n_iter_times+1){
          setTimeout(function(){
            loading_screen.style.display = 'none';
            map_modal.style.display = "none";
            progress_bar.style.width = "0%";
            ctx_image.putImageData(images[getFourierIndex(last_i-parseInt(first_i))], 0, 0);
            ctx_image_map.putImageData(images[getFourierIndex(last_i-parseInt(first_i))], 0, 0);
          },1000);
        }
      },(aidx-first_i)*10);
  };

  

  //set time control element from start to end of observation
  time_control.min=first_i;
  time_control.max=last_i.toString();
  time_control.value=last_i.toString();
  time_control.style.display = '';
  play_button.style.display = '';

  //Draw 3D globe
  locations = [];
  for (j=0;j<telescopes.length;j++){
    locations.push({"latitude": telescopes[j].getLatLng().lat, "longitude": telescopes[j].getLatLng().lng})
  } 


  //update Globe plot
  removeAllMarkers();
  addMarkers();
  updateCamera(delta);

  RotateGlobe((source[0]+360/n_iter/n_iter_times*last_i-135)/180.0*Math.PI,last_i);


  //calculate some time data to display
  decimal_hours=(parseInt(last_i)-parseInt(first_i))/(n_iter*n_iter_times-1)*24;
  hours=Math.floor(((parseInt(last_i)-parseInt(first_i))/(n_iter*n_iter_times-1)*24));
  minutes=Math.round((decimal_hours-hours)*60);
  time_count.innerText="Beobachtungszeit " + hours.toString().padStart(2, '0')+":"+minutes.toString().padStart(2, '0')+" h";
  score.innerText="Rekonstruktionslevel: " + getScore().toFixed(2).toString() + "%"; 
 }

function getFourierIndex(n){
  return Math.floor(n/n_iter_times);
}

//determines current score for the reconstructed image
function getScore(){
  var ideal_image=[];

  var imageData=ctx_real_image.getImageData(0, 0, imgSize, imgSize);
  for (var ai = 0; ai < imageData.data.length; ai+=4) {
    // greyscale, so you only need every 4th value
    ideal_image.push(imageData.data[ai]);
  }

  var currentRecImage= ctx_image.getImageData(
    0, 0, imgSize, imgSize);

  var score_image=[];

  for (var ai = 0; ai < currentRecImage.data.length; ai+=4) {
    // greyscale, so you only need every 4th value
    score_image.push(currentRecImage.data[ai]);
  }


  //calculate difference
  var diff=0
  for (var ai=0; ai<score_image.length;ai++){
    diff=diff+Math.abs(ideal_image[ai]-score_image[ai]);
  }

  return (1-diff/(256*score_image.length))*100;

}

function DrawFourierCanvas(u_v_grid){  

  var h_primes = [];
  var h_hats = $h2();
  var h_hats_new=[];
  var indx=0;
  for (let ai=0; ai < imgSize; ai++){
    for (let ak=0; ak < imgSize; ak++){
      if(u_v_grid[ak][ai]==1){
        h_hats_new.push(h_hats[indx].times(1));
      } else {
        h_hats_new.push(h_hats[indx].times(0));
      }
      indx++;
    };    
  };
  h_hats = h_hats_new;

  h_hats = Fourier.unshift(h_hats, [imgSize,imgSize]);
  Fourier.invert(h_hats, h_primes);

  // get the largest magnitude
  var maxMagnitude = 0;
  for (let aj = 0; aj < h_primes.length; aj++) {
    var mag = h_primes[aj];
    if (mag > maxMagnitude) {
      maxMagnitude = mag;
    };
  };

  // store them in a nice function to match the math
  h_ = function(n, m) {
    if (arguments.length === 0) return h_primes;

    var idx = n*imgSize + m;
    return h_primes[idx];
  };

  // clear the canvas
  ctx_image.clearRect(0,0,canvas_img.width,canvas_img.height);

  // draw the pixels
  var currImageData = ctx_image.getImageData(
    0, 0, imgSize, imgSize
  );
  var logOfMaxMag = Math.log(cc*maxMagnitude+1);
  for (let k = 0; k < imgSize; k++) {
    for (let l = 0; l < imgSize; l++) {
      var idxInPixels = 4*(imgSize*k + l);
      currImageData.data[idxInPixels+3] = 255; // full alpha
      var color = Math.log(cc*h_(k, l)+1);
      color = Math.round(255*(color/logOfMaxMag));
      // RGB are the same -> gray
      for (let c = 0; c < 3; c++) { // lol c++
        currImageData.data[idxInPixels+c] = color;
      }
    }
  }
  
  images.push(currImageData);

}


function round(n, places) {
  var mult = Math.pow(10, places);
  return Math.round(mult*n)/mult;
}


function DrawUVCanvas(img_data,ctx_uv,canvas_uv){

// clear the canvas
ctx_uv.clearRect(0,0,canvas_uv.width,canvas_uv.height);

for (y=0; y < img_data.length; y++){
  for (x=0; x < img_data[0].length; x++){
    ctx_uv.fillStyle=["black","white"][img_data[y][x]];
    ctx_uv.fillRect(x,y,1,1)
  };
};

}


function addDraggableMarker(map, latitude, longitude){

  var newicon = new L.Icon({iconUrl: 'img/Teleskop.png',iconAnchor: [25,50]});

  var marker = new L.marker([latitude,longitude],{
    draggable: true,
    autoPan: false,
    icon: newicon
  }).addTo(map);

  return marker;
}


var telescopes = [];
var count_telescopes= 0;

//add event listener to Add Telescope button
var add_tel_button = document.getElementById("add_tel_button");
add_tel_button.addEventListener('click', function() { 
	var marker_new=addDraggableMarker(map,map.getCenter().lat,map.getCenter().lng);
  telescopes[count_telescopes]=marker_new;
  count_telescopes++;
  }, false);

//add event listener to Measure button
var measure_button = document.getElementById("measure_button");
measure_button.addEventListener('click', function() { 
  if (telescopes.length<2){
    alert("Please select at least 2 telescopes!");
  }else{
    //turn on loading screen
    loading_screen.style.display = 'block';
    setTimeout(function(){
      updateUVtracks();
      //turn off loading screen
    }, 200);
  }
}, false);

//add event listener to Play button
var play=false;
var play_button = document.getElementById("play_button");
play_button.addEventListener('click', function() { 
  if(play){
    clearInterval(playLoop);
    play_button.src="img/play_button.svg";
    play=false;
  } else {
    play=true;
    this.src = "img/pause.svg";
    playLoop=setInterval(function(){
        time_control.value++;
        time_control.dispatchEvent(new Event('input'));
        if (time_control.value==time_control.max){
          time_control.value=time_control.min;
        }    
    },full_spin_time/n_iter/n_iter_times);
  }
}, false);
play_button.style.display = 'none';


var time_count = document.getElementById("time_count");
var score = document.getElementById("score");

var time_control = document.getElementById("time_control");
time_control.addEventListener('input', function () {
  var indx = Math.round(time_control.value);
	DrawUVCanvas(u_v_grids[indx],ctx_uv,canvas_uv);
  ctx_image.putImageData(images[getFourierIndex(indx-parseInt(first_i))], 0, 0);
  RotateGlobe((source[0]+360/n_iter/n_iter_times*indx-135)/180.0*Math.PI,indx);
  //determine time count:
  decimal_hours=(indx-parseInt(first_i))/(n_iter*n_iter_times-1)*24;
  hours=Math.floor(((indx-parseInt(first_i))/(n_iter*n_iter_times-1)*24));
  minutes=Math.round((decimal_hours-hours)*60);
  time_count.innerText="Beobachtungszeit " + hours.toString().padStart(2, '0')+":"+minutes.toString().padStart(2, '0')+" h";
  score.innerText="Rekonstruktionslevel: " + getScore().toFixed(2).toString() + "%";
  }, false);
time_control.step=0.0001;
time_control.style.display = 'none';


var elev_lim_control = document.getElementById("elev_lim_control");

//image for main page
var canvas_img=document.getElementById("canvas_image");
canvas_img.width=imgSize;
canvas_img.height=imgSize;
var ctx_image=canvas_img.getContext('2d');
//initialize canvas as black box
ctx_image.fillRect(0, 0, imgSize, imgSize);


//image for map page
var canvas_img_map=document.getElementById("canvas_image_map");
canvas_img_map.width=imgSize;
canvas_img_map.height=imgSize;
var ctx_image_map=canvas_img_map.getContext('2d');
ctx_image_map.fillRect(0, 0, imgSize, imgSize);

//uv plot for main page
var canvas_uv=document.getElementById("canvas_uv");
canvas_uv.width=imgSize;
canvas_uv.height=imgSize;
var ctx_uv=canvas_uv.getContext('2d');
ctx_uv.fillRect(0, 0, imgSize, imgSize);

//uv plot for map page
var canvas_uv_map=document.getElementById("canvas_uv_map");
canvas_uv_map.width=imgSize;
canvas_uv_map.height=imgSize;
var ctx_uv_map=canvas_uv_map.getContext('2d');
ctx_uv_map.fillRect(0, 0, imgSize, imgSize);

//real image plot
var canvas_real_image=document.getElementById("canvas_real_image");
canvas_real_image.width=imgSize;
canvas_real_image.height=imgSize;
var ctx_real_image=canvas_real_image.getContext("2d");

const new_img = new Image();
//image selector
var image_select = document.getElementById("image_select");
image_select.addEventListener("click",function(){
  ctx_real_image.fillRect(0,0,imgSize,imgSize);
  ctx_real_image.font = "40px Arial";
  ctx_real_image.fillStyle = "#ffffff";
  ctx_real_image.fillText("Lädt...", imgSize/2-50, imgSize/2+15);
  ctx_real_image.fillStyle = "#000000"; 
  new_img.src=image_select.value;
  //set astrophysical sizes of images
  if (image_select.value=="img/Punktquelle.png"){
    imgSizeAstro=100 //mas
  } else if (image_select.value=="img/ehtSgr.jpg"){
    imgSizeAstro=0.2 //mas
  } else if (image_select.value=="img/ehtM87.jpg"){
    imgSizeAstro=0.1 //mas
  } else if (image_select.value=="img/HerculesA.jpg"){
    imgSizeAstro=12000 //mas
  } else if (image_select.value=="img/ngc315.png"){
    imgSizeAstro=40 //mas
  }
  plotLim_calc=imgSize*wavelength/(imgSizeAstro/1000/60/60/180*Math.PI)/100000/2;
  pixelSize_calc=plotLim_calc*2/imgSize;
  new_img.addEventListener(
  "load",
  () => {
    ctx_real_image.drawImage(new_img,0,0,imgSize,imgSize);
    var imageData = ctx_real_image.getImageData(0, 0, imgSize, imgSize);
    DrawFourierImage(imageData);

  },false)
},false);

//set default image
image_select.dispatchEvent(new Event('click'));


//image loader
var image = document.getElementById('image');
if (image) {
  image.addEventListener('change', function () {
  if (this.files && this.files[0]) {
    var fr = new FileReader();
    fr.onload = function (ev) {
    var img = new Image();
    img.onload = function () {
    ctx_real_image.drawImage(img, 0, 0, imgSize, imgSize);
    var imageData = ctx_real_image.getImageData(0, 0, imgSize, imgSize);
    DrawFourierImage(imageData);
    };
    img.src = ev.target.result;
    };
    fr.readAsDataURL(this.files[0]);
  }

}, false);}

function DrawFourierImage(imageData){
//calculate Fourier Transform of image

    var h_image=[];
    for (var ai = 0; ai < imageData.data.length; ai+=4) {
      // greyscale, so you only need every 4th value
      h_image.push(imageData.data[ai]);
    }

    h2=function(n,m){
      if (arguments.length ===0) return h_image;
      return h_image[idx];
    };


    var h2_hats = [];
    Fourier.transform(h2(), h2_hats);
    h2_hats = Fourier.shift(h2_hats, [imgSize,imgSize]);

    // get the largest magnitude
    var maxMagnitude = 0;
    for (var ai = 0; ai < h2_hats.length; ai++) {
      var mag = h2_hats[ai].magnitude();
      if (mag > maxMagnitude) {
        maxMagnitude = mag;
      };
    };

    // store them in a nice function to match the math
    $h2 = function(k, l) {
      if (arguments.length === 0) return h2_hats;
      var idx = k*imgSize + l;
      return h2_hats[idx];
    };


    ctx_real_image.putImageData(imageData, 0, 0);


}


var loading_screen = document.getElementById("cover-spin");


// pre-defined telescope arrays

//function to add list of telescopes

var preset_locations = [];
var checkboxes = [];

function addTelescopesToMap(tel_locations){
  for (i=0;i<tel_locations.length;i++){
    var marker_new=addDraggableMarker(map,tel_locations[i][0],tel_locations[i][1]);
    telescopes[count_telescopes]=marker_new;
    count_telescopes++;
  };
}

function removeAllTelescopesFromMap(){
  for (let i=0;i<checkboxes.length;i++){
    if (checkboxes[i].box.checked){
      checkboxes[i].box.click();
    }
  }
  for (let i=0;i<telescopes.length;i++){
    removeTelescopesFromMap([[telescopes[i].getLatLng().lat,telescopes[i].getLatLng().lng]]);
  }
}

function removeTelescopesFromMap(tel_locations){
  if (tel_locations.length>0){
    for (i=0;i<tel_locations.length;i++){    

      function checkTel(telescope) {
        return telescope.getLatLng().lat==tel_locations[i][0] && telescope.getLatLng().lng==tel_locations[i][1];
      };

      const index = telescopes.findIndex(checkTel);

      if (index > -1) {
        map.removeLayer(telescopes[index]);
        telescopes.splice(index, 1);
        count_telescopes--;
      }
    };
  };
}

function changeCheckboxAction(){
  removeTelescopesFromMap(preset_locations);

  preset_locations=[];

  for(let ai=0;ai<checkboxes.length;ai++){
    if(checkboxes[ai].box.checked){
      for(let ak=0;ak<checkboxes[ai].locations.length;ak++){
        //append all Telescopes, but only once
        function checkTel(telescope) {
          return telescope[0]==checkboxes[ai].locations[ak][0] && telescope[1]==checkboxes[ai].locations[ak][1];
        };
        const index = preset_locations.findIndex(checkTel);
        if (index == -1) {
          preset_locations.push(checkboxes[ai].locations[ak]);
        };
      };
    };
  };
  addTelescopesToMap(preset_locations);
}

var vlba = document.getElementById('vlba');

var vlba_locations=[[42.93362, -71.98681],[41.77165, -91.574133],[30.635214, -103.944826],
      [35.775289, -106.24559],[34.30107, -108.11912],[31.956253, -111.612361],
      [37.23176, -118.27714],[48.13117, -119.68325],[19.80159, -155.45581],[17.75652, -64.58376]];

checkboxes.push({"box": vlba, "locations": vlba_locations});

vlba.addEventListener('change', function() {
  changeCheckboxAction();
});

var eht2017 = document.getElementById('eht2017');

var eht2017_locations=[[32.701547,-109.891269],[-23.005893,-67.759155],[37.066162,-3.392918],[19.822485,-155.476718],
      [18.985439,-97.314765],[19.8237546,-155.477420],[-23.024135,-67.754230],[-89.99,-63.453056]];
checkboxes.push({"box": eht2017, "locations": eht2017_locations});

eht2017.addEventListener('change', function() {
  changeCheckboxAction();
});

var eht2018 = document.getElementById('eht2018');

var eht2018_locations=[[32.701547,-109.891269],[-23.005893,-67.759155],[37.066162,-3.392918],[19.822485,-155.476718],
      [18.985439,-97.314765],[19.8237546,-155.477420],[-23.024135,-67.754230],[-89.99,-63.453056],[76.531203,-68.703161],[44.63389,5.90792],[31.9533,-111.615]];
checkboxes.push({"box": eht2018, "locations": eht2018_locations});

eht2018.addEventListener('change', function() {
  changeCheckboxAction();
});

var tanami = document.getElementById('tanami');

var tanami_locations=[[-30.31,149.57],[-31.30,149.07],[-33.00,148.26],[-42.80,147.44],[-31.87,133.81],[-25.89,27.67],[-14.38,132.15],[-29.05,115,35],[-36.43,174.66]];
checkboxes.push({"box": tanami, "locations": tanami_locations});

tanami.addEventListener('change', function() {
  changeCheckboxAction();
});

var ngVLA = document.getElementById('ngVLA');

var ngVLA_locations=[[17.756666666666668, -64.58361111111111], [18.344166666666666, -66.75277777777778], [42.933611111111105, -71.98666666666666], 
  [41.771388888888886, -91.57416666666666], [30.634999999999998, -103.94472222222223], [35.775, -106.24555555555555], [34.301111111111105, -108.11916666666666],
   [31.95638888888889, -111.6125], [37.23166666666667, -118.27694444444444], [48.13111111111111, -119.68333333333334], [49.3, -119.6], [19.80138888888889, -155.45555555555555],
    [22.12666666666667, -159.665], [42.613055555555555, -71.49388888888889], [34.08305555555556, -107.64], [33.20944444444445, -106.05416666666666], 
    [33.47222222222222, -101.205], [31.954722222222223, -108.565], [28.415555555555553, -108.36], [34.12861111111111, -110.09972222222221]];
checkboxes.push({"box": ngVLA, "locations": ngVLA_locations});

ngVLA.addEventListener('change', function() {
  changeCheckboxAction();
});

changeCheckboxAction();


//map modal
var map_modal = document.getElementById("map-modal");
var map_modal_btn = document.getElementById("map-modal-button");
var map_modal_span = document.getElementById("close-map-modal");
map_modal.style.display="none";
map_modal_btn.onclick = function() {
  map_modal.style.display = "block";
  //stop play button
  if(play){
    play_button.dispatchEvent(new Event('click'));
  }
}
map_modal_span.onclick = function() {map_modal.style.display = "none";}

//info modal for map
var info_modal1 = document.getElementById("info-modal-1");
var info_modal_btn1 = document.getElementById("info-modal-button-1");
var info_modal_span1 = document.getElementById("close-info-modal-1");
info_modal_btn1.onclick = function() {info_modal1.style.display = "block";}
info_modal_span1.onclick = function() {info_modal1.style.display = "none";}

//info modal for uv coverage
var info_modal2 = document.getElementById("info-modal-2");
var info_modal_btn2 = document.getElementById("info-modal-button-2");
var info_modal_span2 = document.getElementById("close-info-modal-2");
info_modal_btn2.onclick = function() {info_modal2.style.display = "block";}
info_modal_span2.onclick = function() {info_modal2.style.display = "none";}

//info modal for image
var info_modal3 = document.getElementById("info-modal-3");
var info_modal_btn3 = document.getElementById("info-modal-button-3");
var info_modal_span3 = document.getElementById("close-info-modal-3");
info_modal_btn3.onclick = function() {info_modal3.style.display = "block";}
info_modal_span3.onclick = function() {info_modal3.style.display = "none";}

//info modal for VLBA
var info_modal_vlba = document.getElementById("info-modal-vlba");
var info_modal_btn_vlba = document.getElementById("info-modal-button-vlba");
var info_modal_span_vlba = document.getElementById("close-info-modal-vlba");
info_modal_btn_vlba.addEventListener('click', function() {
  info_modal_vlba.style.display = "block";
  map_modal.style.display="none";});
info_modal_span_vlba.addEventListener('click', function() {
  info_modal_vlba.style.display = "none";
  map_modal.style.display="block";});

//info modal for EHT
var info_modal_eht = document.getElementById("info-modal-eht");
var info_modal_btn_eht = document.getElementById("info-modal-button-eht");
var info_modal_span_eht = document.getElementById("close-info-modal-eht");
info_modal_btn_eht.addEventListener('click', function() {
  info_modal_eht.style.display = "block";
  map_modal.style.display="none";});
info_modal_span_eht.addEventListener('click', function() {
  info_modal_eht.style.display = "none";
  map_modal.style.display="block";});

//info modal for EHT2
var info_modal_btn_eht2 = document.getElementById("info-modal-button-eht2");
info_modal_btn_eht2.addEventListener('click', function() {
  info_modal_eht.style.display = "block";
  map_modal.style.display="none";});
info_modal_span_eht.addEventListener('click', function() {
  info_modal_eht.style.display = "none";
  map_modal.style.display="block";});

//info modal for TANAMI
var info_modal_tanami = document.getElementById("info-modal-tanami");
var info_modal_btn_tanami = document.getElementById("info-modal-button-tanami");
var info_modal_span_tanami = document.getElementById("close-info-modal-tanami");
info_modal_btn_tanami.addEventListener('click', function() {
  info_modal_tanami.style.display = "block";
  map_modal.style.display="none";});
info_modal_span_tanami.addEventListener('click', function() {
  info_modal_tanami.style.display = "none";
  map_modal.style.display="block";});

//info modal for ngVLA
var info_modal_ngvla = document.getElementById("info-modal-ngVLA");
var info_modal_btn_ngvla = document.getElementById("info-modal-button-ngVLA");
var info_modal_span_ngvla = document.getElementById("close-info-modal-ngVLA");
info_modal_btn_ngvla.addEventListener('click', function() {
  info_modal_ngvla.style.display = "block";
  map_modal.style.display="none";});
info_modal_span_ngvla.addEventListener('click', function() {
  info_modal_ngvla.style.display = "none";
  map_modal.style.display="block";});




var reset_button = document.getElementById("reset_button");
reset_button.addEventListener('click', function() { 
  removeAllTelescopesFromMap();
}, false);

//Declination Range Slider JS
// vanilla JavaScript
var input = document.querySelector('.plain-angle-input');

var angle = AngleInput(input);
  
input.oninput = function(e) {
  declination=angle()-90;
}

input.onchange = function(e) {
  declination=angle()-90;
}

//Frequency Range Slider
var slider_freq = document.getElementById("slider_freq");
var output_freq = document.getElementById("output_freq");
output_freq.innerHTML = (Math.pow(10,slider_freq.value/100)/Math.pow(10,10)*230).toFixed(1).toString(); // Display the default slider value

// Update the current slider value (each time you drag the slider handle)
slider_freq.oninput = function() {
  output_freq.innerHTML = (Math.pow(10,slider_freq.value/100)/Math.pow(10,10)*230.).toFixed(1).toString();
  //update wavelength variable
  wavelength=3/(Math.pow(10,slider_freq.value/100)/Math.pow(10,10)*230)*10;
  plotLim_calc=imgSize*wavelength/(imgSizeAstro/1000/60/60/180*Math.PI)/100000/2;
  pixelSize_calc=plotLim_calc*2/imgSize;
} 

slider_freq.dispatchEvent(new Event('input'));



//size globe
onWindowResize();




